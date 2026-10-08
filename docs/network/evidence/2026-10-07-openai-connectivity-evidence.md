# OpenAI / ChatGPT Network Evidence — 2026-10-07

## Scope

This record captures auditable evidence for the ATLAS Network OpenAI/ChatGPT connectivity profile. It separates:

1. official OpenAI requirements;
2. repository implementation evidence;
3. externally observable endpoint evidence;
4. items that remain unverified from ATLAS production egress.

No item is marked PASS without observed evidence.

## Evidence identity

- Evidence date: 2026-10-07
- Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`
- Base branch: `main`
- Base revision: `b3fc5a94c6474acf0e55259478bed8c1f5ff30bf`
- Existing connectivity guidance blob: `3ccecf718617b8ac8f18de20fbe577fbdcb70375`
- Existing guidance path: `docs/network/2026-10-06-openai-connectivity.md`

## Official-source evidence

Primary source:

https://help.openai.com/en/articles/9247338-network-recommendations-for-chatgpt-errors-on-web-and-apps

Observed on 2026-10-07:

- The article identifies itself as updated 2 days earlier.
- It instructs administrators to allowlist OpenAI/ChatGPT domains including:
  - `*.auth.openai.com`
  - `*.chatgpt.com`
  - `*.oaistatic.com`
  - `*.oaiusercontent.com`
  - `*.openai.com`
  - WorkOS, Intercom, Cloudflare challenge, Sentry, Datadog, Stripe and related supporting domains listed by OpenAI.
- ChatGPT WebSocket destination: `wss://ws.chatgpt.com`.
- Codex WebSocket destination: `wss://chatgpt.com/`.
- WebSocket traffic must be allowed over TCP 443 with the standard `Upgrade: websocket` handshake.
- OpenAI warns that TLS inspection/decryption, filtering or proxy enforcement must not rewrite or prematurely close WebSocket traffic.
- Upload failures can be caused by blocking `*.oaiusercontent.com`.
- ChatGPT Voice uses UDP 3478 to current server IP ranges published in `https://openai.com/chatgpt-voice.json`; TCP 443 is the documented fallback.
- OpenAI warns that SSL/TLS inspection can disrupt native app connectivity.

Status source:

https://status.openai.com/

Observed on 2026-10-07: OpenAI reported "fully operational" and no known system-wide issues at the time of observation.

## Repository evidence

The canonical `main` branch already contains:

`docs/network/2026-10-06-openai-connectivity.md`

That document records that the existing `/work/computer-operations` center provides symptom-specific guidance for streaming, uploads, voice, TLS and iOS failures while deliberately avoiding false claims of external-provider readiness.

Repository evidence confirms the implementation follows the ATLAS fail-closed principle: generic fetch failures are not treated as proof of DNS, TLS, firewall, WebSocket or UDP failure.

## External endpoint observations

The following observations were made through the available web retrieval layer on 2026-10-07.

| Gate | Observation | Result |
| --- | --- | --- |
| ChatGPT HTTPS | `https://chatgpt.com/` returned the ChatGPT web application/login surface | PASS — public HTTPS reachability observed |
| Authentication HTTPS | `https://auth.openai.com/` returned the OpenAI session/login surface | PASS — public HTTPS reachability observed |
| OpenAI status | `https://status.openai.com/` reported fully operational | PASS — provider status observed |
| WebSocket host root | ordinary HTTPS GET to `https://ws.chatgpt.com/` returned HTTP 404 | REACHABLE, NOT A WEBSOCKET PASS |
| Upload host root | ordinary HTTPS GET to `https://files.oaiusercontent.com/` returned HTTP 404 | REACHABLE, NOT AN UPLOAD PASS |
| Voice range feed | retrieval layer reached the resource but could not render its `application/octet-stream` response | SOURCE EXISTS; CONTENT NOT VERIFIED HERE |

A 404 on an endpoint root is evidence that the hostname/path reached an HTTP origin; it is not evidence that an authenticated upload or WebSocket session succeeds.

## Negative / blocked evidence

A separate shell probe attempted DNS, HTTPS, TLS and WebSocket-upgrade checks from the isolated execution container. DNS resolution was unavailable in that container and all direct probes failed at name resolution.

This is recorded as **environment-limited**, not as an ATLAS, OpenAI, ISP, device or user-network failure.

## P0/P1 gate status

| Requirement | Priority | Status | Evidence |
| --- | --- | --- | --- |
| Official allowlist documented | P0 | PASS | OpenAI Help Center source captured |
| HTTPS to ChatGPT | P0 | PASS | ChatGPT web surface retrieved |
| HTTPS to auth.openai.com | P0 | PASS | OpenAI authentication surface retrieved |
| OpenAI global service status | P0 | PASS | status.openai.com reported fully operational |
| DNS from ATLAS production egress | P0 | UNVERIFIED | no production-egress probe available in this evidence run |
| TLS chain from ATLAS production egress | P0 | UNVERIFIED | no production-egress probe available |
| WebSocket Upgrade to ws.chatgpt.com | P0 | UNVERIFIED | ordinary HTTPS reachability is not equivalent to WebSocket success |
| Codex WebSocket Upgrade to chatgpt.com | P0 | UNVERIFIED | authenticated streaming session not exercised |
| Upload transaction to oaiusercontent.com | P0 | UNVERIFIED | root reachability is not a file upload transaction |
| TLS inspection exception on managed network | P0 | UNVERIFIED | requires inspection of the actual ATLAS/network policy |
| Voice UDP 3478 | P1 unless Voice is release-critical | UNVERIFIED | UDP egress not exercised |
| Voice IP feed retrieval/parsing | P1 | PARTIAL | source reached; payload not parsed by current retrieval layer |
| Supporting dependency domains | P1 | DOCUMENTED | domains captured from official source; production egress not individually tested |

## Acceptance rule

This evidence does **not** authorize marking the OpenAI network profile production-ready.

Production readiness requires a probe running from the actual ATLAS production/managed-network egress that verifies, at minimum:

- DNS resolution;
- TLS certificate validation;
- HTTPS reachability;
- WebSocket upgrade/streaming behavior;
- upload transaction behavior;
- absence of destructive TLS inspection/proxy rewriting;
- Voice UDP 3478 when Voice is in the release scope.

Under Fail Closed, any required P0 failure must fail the verification.

## Conclusion

Evidence now exists for the official requirements, repository implementation record, public HTTPS surfaces and provider status.

The remaining production-network transport gates are explicitly retained as UNVERIFIED rather than being converted into assumed PASS states.
