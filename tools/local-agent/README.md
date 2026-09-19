# ATLAS Local Agent reference runtime

This is the reference runtime for the ATLAS Local Control Plane. It does not scan the LAN and it does not claim generic hardware support.

## Required environment

- `ATLAS_LOCAL_CONTROL_URL`: the deployed `atlas-local-control` Edge Function URL.
- First enrollment: `ATLAS_AGENT_ENROLLMENT_CODE` from Device OS. The code is single-use and expires quickly.
- Existing short session: `ATLAS_AGENT_SESSION_TOKEN` may be supplied instead of an enrollment code. Sessions expire and are rotated by heartbeat.
- `ATLAS_LOCAL_DEVICES_JSON`: explicit local device definitions. Do not put credentials in endpoint URLs or synced metadata.

Example device configuration:

```json
[
  {
    "external_id": "front-desk-health",
    "label": "Front Desk Local Service",
    "device_type": "service",
    "adapter": "http-health",
    "capabilities": ["health.check"],
    "endpoint": "http://192.168.1.20:8080/health"
  }
]
```

The P0 `http-health` adapter performs only `health.check/status.read`. Unsupported commands fail explicitly. Provider-specific printers, POS, hotel locks, Matter/Thread, cameras, modems and vehicle adapters require their real supported protocol and authorization before being added.

Run with Node 22+:

```bash
node tools/local-agent/atlas-local-agent.mjs
```

Treat enrollment/session values as secrets. Supply them through the host service manager or secret store; never commit them, place them in tickets, or print them to logs.


## ATLAS Local AI Runtime — zero external API spend

ATLAS can run model inference on hardware you control instead of sending prompts to a metered AI API. The canonical `atlas-copilot` provider id is `atlas-local`.

The reference path uses `llama.cpp` because its server exposes OpenAI-compatible `/v1/responses`, `/v1/models`, health checks, structured output and function-calling support. ATLAS still owns tenant/RBAC/audit/tool approvals.

Required runtime environment:

- `ATLAS_LOCAL_AI_TOKEN`: random bearer token used by the local runtime. Never commit it.
- Either `ATLAS_LOCAL_AI_MODEL_FILE` for an existing GGUF model or `ATLAS_LOCAL_AI_HF_REPO` for a compatible Hugging Face GGUF repository.
- `ATLAS_LOCAL_AI_BINARY`: optional path/name for `llama-server`.
- `ATLAS_LOCAL_AI_HOST`: defaults to `127.0.0.1`.
- `ATLAS_LOCAL_AI_PORT`: defaults to `8080`.
- `ATLAS_LOCAL_AI_CONTEXT`: defaults to `32768`.
- `ATLAS_LOCAL_AI_GPU_LAYERS`: optional integer GPU offload setting.

Start the reference runtime:

```bash
node tools/local-agent/atlas-local-ai-runtime.mjs
```

The launcher passes the API key to llama.cpp through the `LLAMA_API_KEY` environment variable rather than a command-line secret.

For the deployed Supabase Edge `atlas-copilot` to reach this runtime, expose it only through an authenticated HTTPS reverse proxy/tunnel. Do not expose an unauthenticated llama server directly to the public internet.

Server-side ATLAS configuration:

```text
ATLAS_LOCAL_AI_URL=https://<authorized-local-runtime-host>
ATLAS_LOCAL_AI_TOKEN=<same-runtime-token>
ATLAS_LOCAL_AI_MODEL=<model id/alias exposed by the runtime>
ATLAS_AI_ENFORCE_ZERO_COST=true
ATLAS_AI_ALLOW_PAID_SINGLE=false
ATLAS_AI_ALLOW_COUNCIL=false
ATLAS_AI_ZERO_COST_PROVIDERS=atlas-local
```

ATLAS does not mark the local runtime ready merely because these variables exist. `/health` must verify successfully. If `atlas-local` is unavailable, the default policy blocks paid fallbacks instead of silently spending money.

"Zero cost" here means zero automatic third-party AI API charges. Local hardware, electricity, internet, storage, or optional hosting/tunnel costs are outside the model API cost boundary.
