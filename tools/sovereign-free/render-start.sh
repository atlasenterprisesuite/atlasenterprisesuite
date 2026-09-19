#!/usr/bin/env bash
set -euo pipefail
: "${ATLAS_SOVEREIGN_FREE_TOKEN:?ATLAS_SOVEREIGN_FREE_TOKEN is required}"
MODEL="${ATLAS_SOVEREIGN_FREE_HF_REPO:-tensorblock/SmolLM2-135M-Instruct-GGUF:Q4_K_M}"
ALIAS="${ATLAS_SOVEREIGN_FREE_MODEL_ALIAS:-atlas-sovereign-free}"
CONTEXT="${ATLAS_SOVEREIGN_FREE_CONTEXT:-2048}"
mkdir -p /tmp/atlas-sovereign-free
.atlas-sovereign/bin/llama serve -hf "$MODEL" --host 127.0.0.1 --port 8081 -c "$CONTEXT" --alias "$ALIAS" > /tmp/atlas-sovereign-free/llama.log 2>&1 &
LLAMA_PID=$!
cleanup(){ kill "$LLAMA_PID" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
deadline=$((SECONDS+180))
until curl --silent --fail --max-time 3 http://127.0.0.1:8081/health >/dev/null; do
  if ! kill -0 "$LLAMA_PID" 2>/dev/null; then
    cat /tmp/atlas-sovereign-free/llama.log >&2 || true
    exit 1
  fi
  if [ "$SECONDS" -ge "$deadline" ]; then
    cat /tmp/atlas-sovereign-free/llama.log >&2 || true
    exit 1
  fi
  sleep 2
done
exec node tools/sovereign-free/relay.mjs
