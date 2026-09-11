# ATLAS Creator FLUX Runtime

This service is the first self-hosted generation engine for ATLAS Creator Zero-Cost Mode. It exposes the internal HTTP contract consumed by `atlas-creator-generate` and contains no paid-provider fallback.

## Runtime contract

- `GET /health` reports hardware/readiness truthfully.
- `POST /generate` accepts an image prompt and returns a verified generated asset only after FLUX completes.
- Both endpoints require the `x-atlas-runtime-token` service credential.
- The default model is `black-forest-labs/FLUX.1-schnell`.
- If no supported GPU is present, the service reports `resource-blocked` unless CPU execution was explicitly enabled.

## Environment

- `ATLAS_FLUX_RUNTIME_TOKEN` — required service-to-service secret. Configure the same secret in the Supabase `atlas-creator-generate` runtime.
- `ATLAS_FLUX_MODEL_ID` — optional model override; defaults to FLUX.1 Schnell.
- `ATLAS_ALLOW_CPU_FLUX` — defaults to `false`. Set `true` only when slow CPU generation is acceptable.
- `ATLAS_FLUX_CPU_OFFLOAD` — defaults to `true` for CUDA hosts.
- `ATLAS_FLUX_LOCAL_FILES_ONLY` — defaults to `false`; set `true` after model weights have been staged locally.

ATLAS Supabase must point `ATLAS_FLUX_LOCAL_URL` to this service through an authorized private/internal route. Even if the route is reachable over the public network, requests without the runtime token are rejected.

## Local launch

Use a Python environment whose PyTorch build matches the host hardware, then install `requirements.txt`, set a local runtime token, and run:

```bash
export ATLAS_FLUX_RUNTIME_TOKEN="replace-with-a-long-random-secret"
uvicorn app:app --host 127.0.0.1 --port 8000
```

Probe:

```bash
curl -H "x-atlas-runtime-token: $ATLAS_FLUX_RUNTIME_TOKEN" http://127.0.0.1:8000/health
```

A health response is not evidence that production generation is ready unless `ready` is `true` and a real authenticated `/generate` request succeeds.
