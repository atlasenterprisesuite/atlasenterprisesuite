#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  echo "Run this installer as root." >&2
  exit 1
fi

command -v node >/dev/null 2>&1 || { echo "Node.js 22+ is required." >&2; exit 1; }
NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])")"
[ "$NODE_MAJOR" -ge 22 ] || { echo "Node.js 22+ is required." >&2; exit 1; }
command -v openssl >/dev/null 2>&1 || { echo "OpenSSL is required to create the mTLS key and CSR." >&2; exit 1; }

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="/opt/atlas/local-agent"
CONFIG_DIR="/etc/atlas/local-agent"
STATE_DIR="/var/lib/atlas/local-agent"
SERVICE_USER="atlas-agent"
SERVICE_NAME="atlas-local-agent"

if ! id "$SERVICE_USER" >/dev/null 2>&1; then
  useradd --system --home "$STATE_DIR" --shell /usr/sbin/nologin "$SERVICE_USER"
fi

install -d -m 0755 "$INSTALL_DIR" "$INSTALL_DIR/lib"
install -d -m 0750 -o "$SERVICE_USER" -g "$SERVICE_USER" "$CONFIG_DIR" "$STATE_DIR"
install -m 0755 "$SOURCE_DIR/atlas-local-agent.mjs" "$INSTALL_DIR/atlas-local-agent.mjs"
install -m 0644 "$SOURCE_DIR/lib/realtime-client.mjs" "$INSTALL_DIR/lib/realtime-client.mjs"
install -m 0644 "$SOURCE_DIR/lib/secure-state.mjs" "$INSTALL_DIR/lib/secure-state.mjs"

if [ ! -f "$CONFIG_DIR/agent.key" ]; then
  openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out "$CONFIG_DIR/agent.key"
  chown "$SERVICE_USER:$SERVICE_USER" "$CONFIG_DIR/agent.key"
  chmod 0600 "$CONFIG_DIR/agent.key"
fi

HOST_ID="$(hostname | tr -cd 'A-Za-z0-9._-' | cut -c1-64)"
openssl req -new -key "$CONFIG_DIR/agent.key" -out "$CONFIG_DIR/agent.csr"   -subj "/O=ATLAS Enterprise Suite/OU=Local Agent/CN=${HOST_ID:-local-agent}"
chown "$SERVICE_USER:$SERVICE_USER" "$CONFIG_DIR/agent.csr"
chmod 0640 "$CONFIG_DIR/agent.csr"

if [ -n "${ATLAS_AGENT_ENROLLMENT_CODE:-}" ]; then
  printf '%s' "$ATLAS_AGENT_ENROLLMENT_CODE" > "$CONFIG_DIR/enrollment.code"
else
  read -r -s -p "ATLAS one-time enrollment code: " ENROLLMENT_CODE
  echo
  printf '%s' "$ENROLLMENT_CODE" > "$CONFIG_DIR/enrollment.code"
  unset ENROLLMENT_CODE
fi
unset ATLAS_AGENT_ENROLLMENT_CODE
chown "$SERVICE_USER:$SERVICE_USER" "$CONFIG_DIR/enrollment.code"
chmod 0600 "$CONFIG_DIR/enrollment.code"

if [ ! -f "$CONFIG_DIR/devices.json" ]; then
  printf '[]\n' > "$CONFIG_DIR/devices.json"
  chown "$SERVICE_USER:$SERVICE_USER" "$CONFIG_DIR/devices.json"
  chmod 0640 "$CONFIG_DIR/devices.json"
fi

cat > "$CONFIG_DIR/agent.env" <<EOF
ATLAS_AGENT_STATE_FILE=$STATE_DIR/state.json
ATLAS_AGENT_ENROLLMENT_CODE_FILE=$CONFIG_DIR/enrollment.code
ATLAS_LOCAL_DEVICES_FILE=$CONFIG_DIR/devices.json
ATLAS_AGENT_MTLS_CERT_FILE=$CONFIG_DIR/agent.crt
ATLAS_AGENT_MTLS_KEY_FILE=$CONFIG_DIR/agent.key
ATLAS_LOCAL_CONTROL_URL=https://ggmanzcgtlrvqfoccgsh.supabase.co/functions/v1/atlas-local-control
ATLAS_AGENT_REALTIME_URL=wss://www.atlasenterprisesuite.com/_atlas/local-bus/connect
EOF
chown root:"$SERVICE_USER" "$CONFIG_DIR/agent.env"
chmod 0640 "$CONFIG_DIR/agent.env"

cat > "/etc/systemd/system/$SERVICE_NAME.service" <<EOF
[Unit]
Description=ATLAS Local Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_USER
EnvironmentFile=$CONFIG_DIR/agent.env
ExecStart=$(command -v node) $INSTALL_DIR/atlas-local-agent.mjs
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$STATE_DIR $CONFIG_DIR
UMask=0077

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
echo "CSR created: $CONFIG_DIR/agent.csr"
echo "Save the Cloudflare-issued public certificate as $CONFIG_DIR/agent.crt and bind its fingerprint/serial/expiry in ATLAS Device OS."
systemctl restart "$SERVICE_NAME" || true
