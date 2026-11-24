# ATLAS SONIC Intelligence — RUN 003

Reuses the ATLAS Local Agent and its loopback validator. The browser-local SONIC Core and MIDI remain independent of this optional neural runtime.

## Model candidate and provenance

- ACE-Step 1.5 source: https://github.com/ace-step/ACE-Step-1.5 (MIT declared).
- Model card: https://huggingface.co/ACE-Step/Ace-Step1.5 (MIT declared).
- API contract: https://ace-step.github.io/ACE-Step-1.5/en/API .
- Candidate model: acestep-v15-turbo. The model identifier is not a verified checkpoint revision. Before enabling a real runtime, review and pin source and all checkpoint/dependency revisions, hashes, notices and training/output rights. Do not assume the license guarantees originality or commercial clearance.
- No model downloads, installs, GPU allocation, public endpoints or paid API requests in this change.

## Local execution

An operator must separately install and review an authenticated ACE-Step runtime on a controlled machine. Bind it to numeric loopback only, block external network egress, verify checkpoint integrity, and enforce OS-level resource and queue limits before enabling the adapter. The client approval flag is a local operator assertion, not proof of RBAC, attestation or server isolation.

Set ATLAS_SONIC_ENDPOINT to the reviewed numeric loopback origin (default http://127.0.0.1:8001); set ATLAS_SONIC_TOKEN through the local secret store, never in GitHub or browser code. Set ATLAS_SONIC_RUNTIME_APPROVED=true only after the above checks.

From the repository root, pipe a JSON object on stdin to:
- node tools/local-agent/atlas-sonic-local.mjs submit
- node tools/local-agent/atlas-sonic-local.mjs status

Submit example:
```json
{"genre":"ambient","instruments":"piano, strings","prompt":"Original instrumental sketch","duration":20,"bpm":100,"key":"C Major","seed":777}
```

Status accepts a JSON object with taskId returned by submission. One request per invocation; no automatic retries or polling. A timeout can mean submission was accepted but acknowledgement lost; reconcile with the local server before submitting again. No cancellation or idempotency claim.

Initial profile: instrumental text-to-music only, one output, 10–30 seconds, 60–180 BPM, eight inference steps, bounded input and JSON response, 15 second request timeout. These limit request size, not actual CPU/GPU/RAM or total job execution time. The runtime must impose its own limits. No cloud fallback, reference audio upload, automatic model download or automatic publication. Returned task identifiers and status are not proof of inference or ownership. Even reported-success retains audioVerified=false; result retrieval, audio validation and private asset custody are not yet implemented.

## P0 release gates

- Exact-HEAD integrated CI, build and security checks.
- Real pinned ACE-Step runtime with authenticated loopback, network isolation and measured CPU/GPU/RAM.
- Actual original WAV retrieval, decoding, duration and digest evidence; model and generation provenance.
- Tenant-scoped orchestration and job ownership, cancellation, idempotency, quotas and accessibility before remote Studio integration.
- No production readiness or Suno parity claim until evidence supports it.
