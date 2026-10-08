#!/usr/bin/env bash
# Portable per-user installer: no sudo, network, model download or background service.
set -euo pipefail
umask 077
command -v node >/dev/null 2>&1 || { echo 'Node.js 22+ required' >&2; exit 1; }
NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
[ "$NODE_MAJOR" -ge 22 ] || { echo 'Node.js 22+ required' >&2; exit 1; }
[ "$(uname -s)" = Linux ] || { echo 'Linux host required' >&2; exit 1; }
[ "$(id -u)" -ne 0 ] || { echo 'Install under your regular user; do not use sudo' >&2; exit 1; }

SOURCE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="${XDG_DATA_HOME:-$HOME/.local/share}/atlas/local-core"
VAULT_PARENT="$HOME/.atlas"
VAULT="$VAULT_PARENT/local-core"
for target in "$ROOT" "$VAULT_PARENT" "$VAULT"; do
  [ ! -L "$target" ] || { echo "Refusing symlink directory: $target" >&2; exit 1; }
done
mkdir -p "$ROOT/runtime/lib" "$VAULT_PARENT" "$VAULT"
chmod 0700 "$ROOT" "$ROOT/runtime" "$ROOT/runtime/lib" "$VAULT_PARENT" "$VAULT"
for name in atlas-local-core-device.mjs atlas-local-core.mjs atlas-local-ai-runtime.mjs; do
  [ -f "$SOURCE/$name" ] || { echo "Missing installer source: $name" >&2; exit 1; }
  install -m 0600 "$SOURCE/$name" "$ROOT/runtime/$name"
done
for name in local-core-vault.mjs local-core-client.mjs; do
  [ -f "$SOURCE/lib/$name" ] || { echo "Missing installer source: $name" >&2; exit 1; }
  install -m 0600 "$SOURCE/lib/$name" "$ROOT/runtime/lib/$name"
done
cat > "$ROOT/atlas-local-core" <<'SH'
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$ROOT/runtime/atlas-local-core-device.mjs" "$@"
SH
chmod 0700 "$ROOT/atlas-local-core"
node --check "$ROOT/runtime/atlas-local-core-device.mjs"
node --check "$ROOT/runtime/lib/local-core-vault.mjs"
"$ROOT/atlas-local-core" doctor
printf '\nInstalled to: %s\nRun: "%s/atlas-local-core" help\n' "$ROOT" "$ROOT"
printf 'No AI model, token, remote access or background service has been installed.\n'
