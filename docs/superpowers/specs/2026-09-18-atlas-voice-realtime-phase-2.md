# ATLAS Voice Phase 2 — Realtime + Governed Action Bus

## Purpose

Phase 2 adds an authenticated WebRTC speech-to-speech path without replacing ATLAS governance.

The browser never receives an OpenAI API key. It creates a local WebRTC offer and sends only the SDP offer through the authenticated ATLAS Copilot boundary. The server validates ATLAS identity, organization membership and `intelligence.use`, then creates the provider call.

## Runtime configuration

Realtime is intentionally fail-closed.

- `ATLAS_REALTIME_ENABLED=true` — permits the realtime feature to be considered.
- `ATLAS_REALTIME_ALLOW_PAID=true` — explicit authorization for metered realtime provider usage.
- `ATLAS_REALTIME_MODEL` — optional model override. The source default is the currently verified `gpt-realtime-2.1`.
- `ATLAS_REALTIME_TRANSCRIBE_MODEL` — optional input transcription model override. Default: `gpt-live-transcribe`.
- `OPENAI_API_KEY` — remains server-side in the existing secret boundary.

If either realtime enablement or paid-call authorization is absent, `/voice/assistant` keeps the existing guarded turn engine available.

## Security boundary

Realtime sessions are conversational only.

Provider-side tools are explicitly disabled with `tools: []` and `tool_choice: none`. A realtime model must not directly mutate ATLAS business state.

Voice actions are evaluated by the Voice Action Bus:

- low risk + no side effect + no cost -> allow;
- medium/reversible -> require explicit confirmation;
- high/critical/irreversible/metered -> route to the shared ATLAS Approval Center policy;
- malformed/unknown action -> deny.

This layer does not create a second approval implementation. It is a voice-specific policy adapter for the existing execution/approval/audit architecture.

## Full-duplex behavior

The web client:

1. requests microphone access locally;
2. establishes authenticated WebRTC through ATLAS;
3. plays the remote provider audio stream;
4. consumes realtime server events over the data channel;
5. displays input/output transcript events when available;
6. supports barge-in via `response.cancel` plus `output_audio_buffer.clear`;
7. retains Guarded Turn as a fallback if Realtime is unavailable.

## Production gate

Do not claim Realtime operational merely because the code is deployed. Production readiness requires:

1. server secrets/configuration present;
2. authenticated status reports `realtime.enabled=true`;
3. an actual WebRTC call succeeds;
4. no provider key is exposed to the browser;
5. global production verification remains green;
6. cost authorization remains explicit and auditable.
