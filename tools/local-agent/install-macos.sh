#!/usr/bin/env bash
set -euo pipefail

if [ "${EUID:-$(id -u)}" -ne 0 ]; then
  echo "Run this installer with sudo." >&2
  exit 1
fi

command -v node >/dev/null 2>&1 || { echo "Node.js 22+ is required." >&2; exit 1; }
NODE_MAJOR="$(node -p "Number(process.versions.node.split('.')[0])")"
[ "$NODE_MAJOR" -ge 22 ] || { echo "Node.js 22+ is required." >&2; exit 1; }
command -v openssl >/dev/null 2>&1 || { echo "OpenSSL is required." >&2; exit 1; }

SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE="/Library/Application Support/ATLAS/LocalAgent"
INSTALL_DIR="$BASE/runtime"
CONFIG_DIR="$BASE/config"
STATE_DIR="$BASE/state"
PLIST="/Library/LaunchDaemons/com.atlasenterprisesuite.localagent.plist"

install -d -m 0755 "$INSTALL_DIR" "$INSTALL_DIR/lib"
install -d -m 0700 "$CONFIG_DIR" "$STATE_DIR"
install -m 0755 "$SOURCE_DIR/atlas-local-agent.mjs" "$INSTALL_DIR/atlas-local-agent.mjs"
install -m 0644 "$SOURCE_DIR/lib/realtime-client.mjs" "$INSTALL_DIR/lib/realtime-client.mjs"
install -m 0644 "$SOURCE_DIR/lib/secure-state.mjs" "$INSTALL_DIR/lib/secure-state.mjs"

if [ ! -f "$CONFIG_DIR/agent.key" ]; then
  openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out "$CONFIG_DIR/agent.key"
  chmod 0600 "$CONFIG_DIR/agent.key"
fi
HOST_ID="$(scutil --get ComputerName 2>/dev/null | tr -cd 'A-Za-z0-9._-' | cut -c1-64)"
openssl req -new -key "$CONFIG_DIR/agent.key" -out "$CONFIG_DIR/agent.csr"   -subj "/O=ATLAS Enterprise Suite/OU=Local Agent/CN=${HOST_ID:-mac-local-agent}"
chmod 0600 "$CONFIG_DIR/agent.csr"

if [ -n "${ATLAS_AGENT_ENROLLMENT_CODE:-}" ]; then
  printf '%s' "$ATLAS_AGENT_ENROLLMENT_CODE" > "$CONFIG_DIR/enrollment.code"
else
  read -r -s -p "ATLAS one-time enrollment code: " ENROLLMENT_CODE
  echo
  printf '%s' "$ENROLLMENT_CODE" > "$CONFIG_DIR/enrollment.code"
  unset ENROLLMENT_CODE
fi
unset ATLAS_AGENT_ENROLLMENT_CODE
chmod 0600 "$CONFIG_DIR/enrollment.code"

[ -f "$CONFIG_DIR/devices.json" ] || printf '[]\n' > "$CONFIG_DIR/devices.json"
chmod 0600 "$CONFIG_DIR/devices.json"

NODE_BIN="$(command -v node)"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.atlasenterprisesuite.localagent</string>
  <key>ProgramArguments</key><array><string>$NODE_BIN</string><string>$INSTALL_DIR/atlas-local-agent.mjs</string></array>
  <key>EnvironmentVariables</key><dict>
    <key>ATLAS_AGENT_STATE_FILE</key><string>$STATE_DIR/state.json</string>
    <key>ATLAS_AGENT_ENROLLMENT_CODE_FILE</key><string>$CONFIG_DIR/enrollment.code</string>
    <key>ATLAS_LOCAL_DEVICES_FILE</key><string>$CONFIG_DIR/devices.json</string>
    <key>ATLAS_AGENT_MTLS_CERT_FILE</key><string>$CONFIG_DIR/agent.crt</string>
    <key>ATLAS_AGENT_MTLS_KEY_FILE</key><string>$CONFIG_DIR/agent.key</string>
    <key>ATLAS_LOCAL_CONTROL_URL</key><string>https://ggmanzcgtlrvqfoccgsh.supabase.co/functions/v1/atlas-local-control</string>
    <key>ATLAS_AGENT_REALTIME_URL</key><string>wss://www.atlasenterprisesuite.com/_atlas/local-bus/connect</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
  <key>StandardOutPath</key><string>$STATE_DIR/stdout.log</string>
  <key>StandardErrorPath</key><string>$STATE_DIR/stderr.log</string>
</dict></plist>
EOF
chmod 0644 "$PLIST"

launchctl bootout system/com.atlasenterprisesuite.localagent >/dev/null 2>&1 || true
launchctl bootstrap system "$PLIST"
echo "CSR: $CONFIG_DIR/agent.csr"
echo "Save the issued public certificate as $CONFIG_DIR/agent.crt and bind its metadata in Device OS."
