#!/usr/bin/env bash
# No fallback: tests may run only inside a new, disconnected network namespace.
set -euo pipefail
cd "$(dirname "$0")/.."
command -v unshare >/dev/null || { echo 'BLOCKED: unshare unavailable' >&2; exit 78; }
# Probe separately so a namespace failure has a stable blocked exit code.
if ! unshare --user --map-root-user --net -- true; then
  echo 'BLOCKED: network namespace unavailable; no tests started' >&2
  exit 78
fi
exec unshare --user --map-root-user --net -- env -i PATH="$PATH" HOME=/tmp NODE_ENV=test bash -s <<'ISOLATED'
  set -euo pipefail
  node -e 'const fs = require("node:fs");
    const interfaces = fs.readdirSync("/sys/class/net");
    if (interfaces.some(name => name !== "lo")) {
      console.error("BLOCKED: unexpected network interface"); process.exit(78);
    }
    console.log("Network namespace verified: no external interfaces");'
  # Do not inherit real provider configuration or execute npm lifecycle hooks.
  exec env -i PATH="$PATH" HOME=/tmp NODE_ENV=test \
    node node_modules/vitest/vitest.mjs run \
    tests/integration/advisory-bootstrap-organization-negative.test.ts \
    tests/integration/advisory-actor-org-multitenant-negative.test.ts \
    tests/integration/advisory-aw-finance-rpc-membership.test.ts \
    tests/integration/advisory-remaining-definer-acl-negative.test.ts \
    tests/integration/advisory-rpc-search-path-negative.test.ts \
    tests/integration/advisory-firm-scope-rls.test.ts \
    tests/integration/advisory-office-persistence.test.ts
ISOLATED
