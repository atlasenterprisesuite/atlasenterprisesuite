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

Status accepts a JSON object with taskId returned by submission. Submit/status issue one request per invocation; retrieve issues a status request followed by one download. No automatic retries or polling. A timeout can mean submission was accepted but acknowledgement lost; reconcile with the local server before submitting again. No cancellation or idempotency claim.

Initial profile: instrumental text-to-music only, one output, 10–30 seconds, 60–180 BPM, eight inference steps, bounded input and JSON response, 15 second request timeout. These limit request size, not actual CPU/GPU/RAM or total job execution time. The runtime must impose its own limits. No cloud fallback, reference audio upload, automatic model download or automatic publication. Returned task identifiers and status are not proof of inference or ownership. Even reported-success retains audioVerified=false. RUN 004 adds explicit result retrieval and structural/audio validation; private asset custody remains pending.

## P0 release gates

- Exact-HEAD integrated CI, build and security checks.
- Real pinned ACE-Step runtime with authenticated loopback, network isolation and measured CPU/GPU/RAM.
- Actual original WAV retrieval, decoding, duration and digest evidence; model and generation provenance.
- Tenant-scoped orchestration and job ownership, cancellation, idempotency, quotas and accessibility before remote Studio integration.
- No production readiness or Suno parity claim until evidence supports it.

## RUN 004 — verified local output retrieval

Official protocol: https://ace-step.github.io/ACE-Step-1.5/en/API (query_result and GET /v1/audio).
The operator sets ATLAS_SONIC_OUTPUT_ROOT to the approved, isolated POSIX output directory on the runtime (example: /tmp/api_audio). The client accepts one successful result from the requested task, a relative /v1/audio URL, and a single direct WAV filename under that root. No redirects, external URLs, nested directories, or user-supplied download URLs. Server-side realpath/symlink confinement and authenticated task ownership remain required; the local client alone does not prove them. Native Windows drive-letter paths are not supported by this initial profile.

Pipe {"taskId":"<submitted task UUID>","expectedSeconds":20} to node tools/local-agent/atlas-sonic-local.mjs retrieve from an operator-controlled private working directory. Output is sonic-<task UUID>.wav, created exclusively without overwriting. File permission mode 0600 applies on POSIX; Windows ACLs must be configured separately. The client bounds the response to 16 MiB, verifies RIFF/PCM16, mono/stereo, 8–48 kHz, alignment, duration within one second, and non-silence, and returns peak/RMS and SHA-256. These checks do not prove musical quality, originality, provenance, or that the model actually generated the bytes. Model provenance remains false. No automatic import, publication, or remote access.

Local fixture tests: 3/3 PASS under Node v22.16.0. Blob hashes: sonic-wav.mjs 828c26b11617d695f9979cf9a4b0ed361612a8c0; sonic-wav.test.mjs a4bd1bafb91e48d6df3da5cd30093ed3296ab627. Fixture is synthesized test data, not model inference. Integrated retrieval and real runtime still require verification.
