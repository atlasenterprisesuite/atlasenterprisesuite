#!/usr/bin/env bash
set -uo pipefail

# ATLAS OpenAI/ChatGPT connectivity verifier.
# Run this FROM the network/egress being certified.
# It intentionally distinguishes transport reachability from functional/authenticated success.

OUT="${1:-openai-network-evidence.txt}"
: > "$OUT"

PASS=0
FAIL=0
UNVERIFIED=0

log() { printf '%s\n' "$*" | tee -a "$OUT"; }
mark_pass() { PASS=$((PASS+1)); log "PASS | $1 | $2"; }
mark_fail() { FAIL=$((FAIL+1)); log "FAIL | $1 | $2"; }
mark_unverified() { UNVERIFIED=$((UNVERIFIED+1)); log "UNVERIFIED | $1 | $2"; }

log "ATLAS OpenAI network evidence"
log "timestamp_utc=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
log "host=$(hostname 2>/dev/null || echo unknown)"
log ""

check_dns() {
  local host="$1"
  if getent ahosts "$host" >/dev/null 2>&1; then
    mark_pass "dns:$host" "resolved"
  else
    mark_fail "dns:$host" "resolution failed"
  fi
}

check_https_2xx_3xx() {
  local name="$1" url="$2"
  local code
  code="$(curl -sS -L -o /dev/null --max-time 20 -w '%{http_code}' "$url" 2>>"$OUT" || true)"
  if [[ "$code" =~ ^[23][0-9][0-9]$ ]]; then
    mark_pass "$name" "HTTP $code"
  else
    mark_fail "$name" "HTTP ${code:-000}"
  fi
}

check_origin_reachable() {
  local name="$1" url="$2"
  local code
  code="$(curl -sS -L -o /dev/null --max-time 20 -w '%{http_code}' "$url" 2>>"$OUT" || true)"
  if [[ "$code" =~ ^[1-4][0-9][0-9]$ ]]; then
    mark_pass "$name" "origin reachable; HTTP $code (functional transaction not implied)"
  else
    mark_fail "$name" "origin not proven reachable; HTTP ${code:-000}"
  fi
}

check_tls() {
  local host="$1"
  local result
  result="$(echo | openssl s_client -connect "$host:443" -servername "$host" -verify_return_error 2>&1 || true)"
  if grep -q "Verify return code: 0 (ok)" <<<"$result"; then
    local issuer
    issuer="$(printf '%s\n' "$result" | openssl x509 -noout -issuer 2>/dev/null || true)"
    mark_pass "tls:$host" "${issuer:-certificate chain verified}"
  else
    mark_fail "tls:$host" "certificate chain verification failed"
    printf '%s\n' "$result" >> "$OUT"
  fi
}

for host in chatgpt.com auth.openai.com ws.chatgpt.com files.oaiusercontent.com openai.com; do
  check_dns "$host"
done

check_https_2xx_3xx "https:chatgpt" "https://chatgpt.com/"
check_https_2xx_3xx "https:auth" "https://auth.openai.com/"
check_origin_reachable "origin:ws.chatgpt.com" "https://ws.chatgpt.com/"
check_origin_reachable "origin:files.oaiusercontent.com" "https://files.oaiusercontent.com/"

check_tls "chatgpt.com"
check_tls "auth.openai.com"
check_tls "ws.chatgpt.com"

VOICE_TMP="$(mktemp)"
if curl -fsSL --max-time 20 "https://openai.com/chatgpt-voice.json" -o "$VOICE_TMP" 2>>"$OUT"; then
  if python3 -m json.tool "$VOICE_TMP" >/dev/null 2>&1; then
    mark_pass "voice-ip-feed" "downloaded and parsed JSON"
  else
    mark_unverified "voice-ip-feed" "downloaded but JSON parse failed"
  fi
else
  mark_fail "voice-ip-feed" "download failed"
fi
rm -f "$VOICE_TMP"

# A root HTTPS response from the WebSocket host does not prove that an authenticated
# Upgrade: websocket session can remain established. Keep this gate UNVERIFIED unless
# the test is executed with an authorized product/session harness.
mark_unverified "websocket:chatgpt" "requires authorized Upgrade/streaming harness"
mark_unverified "websocket:codex" "requires authorized Upgrade/streaming harness"
mark_unverified "upload-transaction" "requires a real authorized upload transaction"
mark_unverified "voice-udp-3478" "UDP reachability requires a network-specific probe and current voice ranges"
mark_unverified "tls-inspection-policy" "requires inspection of the actual managed firewall/proxy policy"

log ""
log "summary pass=$PASS fail=$FAIL unverified=$UNVERIFIED"

# Fail closed for actual observed P0 transport failures.
# UNVERIFIED is emitted distinctly so callers can enforce stricter release policy.
if (( FAIL > 0 )); then
  exit 1
fi
exit 0
