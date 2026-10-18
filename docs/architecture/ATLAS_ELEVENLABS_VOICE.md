# ElevenLabs narration in ATLAS Voice

Extends the existing `atlas-voice-provider` Edge Function and Voice Studio; no new provider orchestration service, database table or package dependency. The Deno backend uses the documented ElevenLabs REST API instead of introducing the Node SDK into the browser.

## User flow

Open `/voice/studio`, enter up to 1,000 characters, generate MP3, play or download. Voice is George (`JBFqnCBsd6RMkjVDRZzb`), model is `eleven_multilingual_v2`, output is `mp3_44100_128`. Generation is an explicit user action and consumes provider credits. This integration does not create or clone personal voices.

## Backend contract

- `GET /functions/v1/atlas-voice-provider?api=status&provider=elevenlabs`: requires `voice.personal.read`, checks voice access without generating billable audio. `access_verified` is not proof of synthesis; `synthesis_verified` remains false in this probe.
- `POST /functions/v1/atlas-voice-provider?api=speech&provider=elevenlabs`: requires `voice.personal.use`, accepts `{ "text": "..." }`, validates type and length, records tenant/user audit metadata before provider spending, returns disclosed MP3 only on a successful provider response.
- Both use the authenticated organization's membership and explicit `x-atlas-org-id`; no client-provided identity is trusted. No automatic fallback to another provider.
- Audit uses the existing `audit_logs`; narration text and API key are excluded. Requested/accepted events do not assert that streamed playback completed.
- Timeouts: 10 seconds for access, 30 seconds for speech request. No automatic synthesis retries.
- Existing OpenAI Custom Voice endpoints retain their behavior.

## Activation and verification

Configure `ELEVENLABS_API_KEY` as a secret on the canonical Supabase project. Never place it in Vite environment variables, client code, commits or logs. Preserve JWT verification on deployment.

Deploy `index.ts`, `provider-core.mjs` and `elevenlabs.mjs` together after canonical source integration. Deploy the web client through the existing Cloudflare pipeline. Verify the public P0 contract and the exact deployed revision before claiming production completion.

Acceptance tests cover missing credentials, provider errors, invalid input, tenant/permission denial, audit failure before spending, authenticated synthesis, explicit organization selection, playback/download and object URL cleanup. Production acceptance additionally requires an authorized session, actual configured provider credentials and a real successful MP3 generation.

Official API contract: https://elevenlabs.io/docs/api-reference/text-to-speech/convert
