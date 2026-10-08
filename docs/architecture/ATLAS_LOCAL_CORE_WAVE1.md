# ATLAS Local Core — Wave 1 (Windows and Ubuntu)

Status: **prototype only**. Neither a running model nor a connected device is claimed by this documentation.

## Reused architecture

- Existing runtime: `tools/local-agent/atlas-local-ai-runtime.mjs` launches a self-hosted `llama-server` using `LLAMA_API_KEY`.
- Existing canonical provider: `atlas-local` in ATLAS Copilot; enterprise authorization/tenant policy/audit remain server-side.
- Existing Device OS and Local Agent are **not** bypassed and are **not** claimed to be connected by this CLI.
- New local-only console client: `tools/local-agent/atlas-local-core.mjs`. This accesses **only loopback** on the machine invoking it. It never calls cloud APIs and has no automatic remote fallback.

## Requirements

Node.js 22+, a real local `llama-server` binary, a compatible GGUF model file you have already obtained, and sufficient CPU/RAM/GPU resources. No automatic model download is performed by this first-wave client.

Start the existing runtime in one terminal, with a unique, secret random bearer token and an existing local GGUF model.

Ubuntu:

```bash
export ATLAS_LOCAL_AI_TOKEN='<locally-generated-secret>'
export ATLAS_LOCAL_AI_MODEL_FILE='/absolute/path/to/model.gguf'
node tools/local-agent/atlas-local-ai-runtime.mjs
```

Windows PowerShell:

```powershell
$env:ATLAS_LOCAL_AI_TOKEN = '<locally-generated-secret>'
$env:ATLAS_LOCAL_AI_MODEL_FILE = 'C:\\models\\your-model.gguf'
node tools/local-agent/atlas-local-ai-runtime.mjs
```

Use the same token on the same machine in a second terminal, then submit the prompt over standard input.

Ubuntu:

```bash
export ATLAS_LOCAL_AI_TOKEN='<the-same-secret>'
printf 'Explain a local-first AI architecture.\\n' | node tools/local-agent/atlas-local-core.mjs
```

Windows PowerShell:

```powershell
$env:ATLAS_LOCAL_AI_TOKEN = '<the-same-secret>'
'Explain a local-first AI architecture.' | node tools/local-agent/atlas-local-core.mjs
```

Set `ATLAS_LOCAL_AI_URL` only to a loopback HTTP URL (default `http://127.0.0.1:8080`), and `ATLAS_LOCAL_AI_MODEL_ALIAS` if the runtime uses another alias. The CLI refuses LAN/public hosts, paths, URL credentials, redirects, absent authentication and large prompts. It never logs the bearer token or prompt itself. It transmits the prompt to a listening **local model process**; privacy still depends on securing that process, device, OS and any plugins independently.

## Verification

```bash
node --test tools/local-agent/tests/local-core-client.test.mjs
```

Tests use a local HTTP test server, not a model or external API. A passing unit suite proves request controls and client protocol behavior, **not** real-model inference, memory encryption, autonomous agent safety, installer readiness, integration with ATLAS OS UI or production deployment.

## Wave 2 gates (not implemented)

1. Signed and checksummed installers for Windows/Ubuntu with device-local model lifecycle; validate real hardware and offline operation.
2. Model catalogue/download integrity and explicit user consent for network access.
3. Encryption-at-rest and user-controlled memory store, no silent prompt persistence.
4. Authorization via canonical ATLAS org/role/approval/evidence before device remote commands.
5. Permissioned tools/agents, health/readiness UI based only on verified actual runtime evidence.
6. Opt-in cloud provider dispatch only through established ATLAS Policy Fabric, with privacy-compatible fallbacks.
7. CI full suite, controlled rollout and exact-SHA production P0 verification.
