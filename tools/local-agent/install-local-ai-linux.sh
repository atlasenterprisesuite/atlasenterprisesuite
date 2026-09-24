#!/usr/bin/env bash
set -euo pipefail
umask 077

if [ "${EUID}" -ne 0 ]; then
  echo "install-local-ai-linux.sh must run as root" >&2
  exit 1
fi

: "${ATLAS_LOCAL_AI_TOKEN:?ATLAS_LOCAL_AI_TOKEN is required}"
: "${ATLAS_LOCAL_AI_TUNNEL_TOKEN:?ATLAS_LOCAL_AI_TUNNEL_TOKEN is required}"

MODEL_REPO="${ATLAS_LOCAL_AI_HF_REPO:-ggml-org/Qwen3.5-0.8B-GGUF:Q4_0}"
MODEL_ALIAS="${ATLAS_LOCAL_AI_MODEL_ALIAS:-atlas-local-default}"
CONTEXT="${ATLAS_LOCAL_AI_CONTEXT:-8192}"
LLAMA_VERSION="${ATLAS_LLAMA_CPP_VERSION:-v0.4.1}"

INSTALL_ROOT="/opt/atlas/local-ai"
SOURCE_DIR="${INSTALL_ROOT}/src/llama.cpp"
BIN_DIR="${INSTALL_ROOT}/bin"
CONFIG_DIR="/etc/atlas/local-ai"
STATE_DIR="/var/lib/atlas/local-ai"
SERVICE_USER="atlas-local-ai"

case "$(uname -s)" in
  Linux) ;;
  *) echo "unsupported operating system" >&2; exit 1 ;;
esac

if ! command -v apt-get >/dev/null 2>&1; then
  echo "This installer currently requires a Debian/Ubuntu apt host." >&2
  exit 1
fi

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends   ca-certificates curl git cmake build-essential libcurl4-openssl-dev

install -d -m 0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg   -o /usr/share/keyrings/cloudflare-main.gpg
chmod 0644 /usr/share/keyrings/cloudflare-main.gpg
printf '%s\n'   'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main'   > /etc/apt/sources.list.d/cloudflared.list
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends cloudflared

if ! id "${SERVICE_USER}" >/dev/null 2>&1; then
  useradd --system --home-dir "${STATE_DIR}" --create-home --shell /usr/sbin/nologin "${SERVICE_USER}"
fi

install -d -o "${SERVICE_USER}" -g "${SERVICE_USER}" -m 0750 "${INSTALL_ROOT}" "${BIN_DIR}" "${STATE_DIR}"
install -d -o root -g "${SERVICE_USER}" -m 0750 "${CONFIG_DIR}"

if [ ! -d "${SOURCE_DIR}/.git" ]; then
  install -d -o root -g root -m 0755 "$(dirname "${SOURCE_DIR}")"
  git clone --filter=blob:none --branch "${LLAMA_VERSION}" --depth 1     https://github.com/ggml-org/llama.cpp.git "${SOURCE_DIR}"
else
  git -C "${SOURCE_DIR}" fetch --tags --depth 1 origin "${LLAMA_VERSION}"
  git -C "${SOURCE_DIR}" checkout --force "${LLAMA_VERSION}"
fi

rm -rf "${SOURCE_DIR}/build"
GPU_LAYERS=0
if command -v nvidia-smi >/dev/null 2>&1 && command -v nvcc >/dev/null 2>&1; then
  if cmake -S "${SOURCE_DIR}" -B "${SOURCE_DIR}/build"       -DCMAKE_BUILD_TYPE=Release -DGGML_CUDA=ON -DLLAMA_CURL=ON &&
     cmake --build "${SOURCE_DIR}/build" --config Release -j "$(nproc)" --target llama-server; then
    GPU_LAYERS=999
  else
    echo "CUDA build unavailable; falling back to CPU." >&2
    rm -rf "${SOURCE_DIR}/build"
  fi
fi

if [ ! -x "${SOURCE_DIR}/build/bin/llama-server" ]; then
  cmake -S "${SOURCE_DIR}" -B "${SOURCE_DIR}/build"     -DCMAKE_BUILD_TYPE=Release -DLLAMA_CURL=ON
  cmake --build "${SOURCE_DIR}/build" --config Release -j "$(nproc)" --target llama-server
  GPU_LAYERS=0
fi

install -m 0755 "${SOURCE_DIR}/build/bin/llama-server" "${BIN_DIR}/llama-server"

cat > "${CONFIG_DIR}/runtime.env" <<EOF
HOME=${STATE_DIR}
LLAMA_API_KEY=${ATLAS_LOCAL_AI_TOKEN}
ATLAS_LOCAL_AI_HF_REPO=${MODEL_REPO}
ATLAS_LOCAL_AI_MODEL_ALIAS=${MODEL_ALIAS}
ATLAS_LOCAL_AI_CONTEXT=${CONTEXT}
ATLAS_LOCAL_AI_GPU_LAYERS=${GPU_LAYERS}
EOF
chown root:"${SERVICE_USER}" "${CONFIG_DIR}/runtime.env"
chmod 0640 "${CONFIG_DIR}/runtime.env"

printf '%s' "${ATLAS_LOCAL_AI_TUNNEL_TOKEN}" > "${CONFIG_DIR}/cloudflared.token"
chown root:"${SERVICE_USER}" "${CONFIG_DIR}/cloudflared.token"
chmod 0640 "${CONFIG_DIR}/cloudflared.token"

cat > /etc/systemd/system/atlas-local-ai.service <<EOF
[Unit]
Description=ATLAS Local AI llama.cpp runtime
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_USER}
EnvironmentFile=${CONFIG_DIR}/runtime.env
WorkingDirectory=${STATE_DIR}
ExecStart=${BIN_DIR}/llama-server --host 127.0.0.1 --port 8080 -c ${CONTEXT} --jinja --alias ${MODEL_ALIAS} -hf ${MODEL_REPO} -ngl ${GPU_LAYERS}
Restart=on-failure
RestartSec=5
TimeoutStartSec=0
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
ReadWritePaths=${STATE_DIR}

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/atlas-local-ai-tunnel.service <<EOF
[Unit]
Description=ATLAS Local AI Cloudflare Tunnel
After=network-online.target atlas-local-ai.service
Wants=network-online.target
Requires=atlas-local-ai.service

[Service]
Type=simple
User=${SERVICE_USER}
Group=${SERVICE_USER}
ExecStart=/usr/bin/cloudflared tunnel --no-autoupdate run --token-file ${CONFIG_DIR}/cloudflared.token
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now atlas-local-ai.service
systemctl enable --now atlas-local-ai-tunnel.service

deadline=$((SECONDS + 600))
until curl --silent --fail --max-time 5 http://127.0.0.1:8080/health >/dev/null; do
  if [ "${SECONDS}" -ge "${deadline}" ]; then
    echo "ATLAS Local AI did not become healthy within 10 minutes." >&2
    systemctl --no-pager --full status atlas-local-ai.service >&2 || true
    exit 1
  fi
  sleep 5
done

systemctl is-active --quiet atlas-local-ai.service
systemctl is-active --quiet atlas-local-ai-tunnel.service

echo "ATLAS Local AI runtime installed and loopback health verified."
