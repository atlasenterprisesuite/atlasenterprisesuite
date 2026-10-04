# ATLAS Telnyx Production Readiness Design

Date: 2026-10-04
Status: approved direction; implementation follows this design under the standing autonomous-execution instruction.

## Objective

Promote the existing ATLAS Communication telephony foundation from a provider-integrated development foundation to a production-verifiable Telnyx path without coupling ATLAS product logic to Telnyx.

The existing provider-neutral boundary remains authoritative. Telnyx is an adapter, not the ATLAS telecom architecture.

## Existing assets to reuse

The implementation MUST reuse the existing ATLAS assets rather than create parallel infrastructure:

- `supabase/functions/_shared/telephony-telnyx.ts`
- `supabase/functions/_shared/telephony-webhook.ts`
- `supabase/functions/atlas-communication-telephony/index.ts`
- `supabase/functions/atlas-communication-telephony-webhook/index.ts`
- `public.atlas_telephony_providers`
- `public.atlas_call_sessions`
- `public.atlas_call_events`
- `/connect/calling`
- the existing ATLAS Connect and ATLAS Voice navigation handoffs

## External evidence already available

Telnyx account approval is evidence for account-level access only. It is not evidence that ATLAS production calling is ready.

The production gate still requires all of the following:

1. a usable Telnyx API key stored server-side;
2. a valid Voice API application / connection ID;
3. an authorized E.164 caller number;
4. an HTTPS ATLAS webhook URL;
5. the Telnyx account public signing key;
6. a successful authenticated provider probe;
7. one controlled outbound call whose webhook lifecycle is verified end-to-end.

No UI or API may report `verified`, `connected`, or `completed` merely because the Telnyx account itself is approved.

## Canonical flow

ATLAS UI / ATLAS Voice
→ ATLAS Communication Telephony API
→ tenant + RBAC + consent gate
→ provider-neutral readiness contract
→ Telnyx adapter
→ Telnyx Voice API
→ signed Telnyx webhook
→ durable ATLAS call event
→ monotonic lifecycle reconciliation
→ audit/evidence surfaces

## Provider configuration contract

The Telnyx voice adapter configuration is complete only when all six values exist and validate:

- `provider = telnyx`
- `api_key`
- `connection_id`
- `from_number`
- `webhook_url`
- `public_key`

`api_key` and `public_key` MUST remain server-side and MUST never be returned by readiness endpoints, logs, UI payloads, or provider evidence.

The public key is part of readiness because a call that can be originated but whose webhook cannot be authenticated is not production-ready.

## Readiness model

Readiness remains fail-closed.

### not_configured

Returned when any required configuration value is missing or locally invalid.

### degraded

Returned when local configuration is complete but the provider probe fails, authentication is rejected, permissions are denied, the connection is absent, Telnyx is rate-limiting, or the provider cannot be reached.

### verified

Returned only after local configuration is complete and a live Telnyx read-only probe succeeds against the configured Voice API connection.

A `verified` result authorizes only capabilities actually evidenced by the probe and adapter contract. It does not imply emergency calling, SMS, recording, inbound routing, or regulatory approval.

## Capability truth

Until separately evidenced:

- outbound voice: enabled only after verified readiness;
- inbound voice: not claimed merely from a successful outbound connection probe;
- SMS/MMS: false in the telephony voice provider record;
- recording: false unless separately configured and consent-controlled;
- realtime audio: adapter-supported but not a production-ready claim until exercised;
- transfer: adapter-supported but not a production-ready claim until exercised;
- emergency calling: always false unless a dedicated compliance/readiness gate is implemented.

This prevents provider feature availability from being confused with account-specific production evidence.

## Webhook security and lifecycle reconciliation

ATLAS MUST preserve the raw body, validate `Telnyx-Signature-Ed25519` and `Telnyx-Timestamp`, enforce the replay window, then accept the event.

Webhook events may be duplicated, delayed, concurrent, or out of order. The provider event ID remains the deduplication key.

The call session MUST NOT regress when a late event arrives. Add an authoritative provider-state timestamp to the call session and apply lifecycle changes only when the incoming event is newer than or equal to the last accepted provider-state timestamp. Terminal states MUST not regress to non-terminal states on stale delivery.

The durable `atlas_call_events` row remains the provider evidence record even when a state transition is ignored as stale.

## Provider evidence

Persist only non-secret evidence needed to prove provider interaction:

- Telnyx request ID;
- HTTP status;
- provider call control ID;
- call leg/session IDs;
- webhook event ID/type;
- provider occurrence timestamp;
- hangup cause/source where available;
- readiness blocker codes.

Do not persist API keys, signing keys, Authorization headers, or full sensitive provider payloads.

## UI behavior

`/connect/calling` remains the user-facing control surface.

It MUST show configuration/readiness truth without secret values. A missing public signing key must appear as an incomplete provider configuration, not as a generic hidden error.

Call controls remain disabled unless readiness is `verified` and the required permission is present. The UI must not synthesize call success from a successful HTTP request; provider webhook evidence controls connected/completed state.

## Testing

Implementation must add or update tests for:

1. public signing key required for readiness;
2. secret values never returned;
3. invalid signing-key encoding rejected locally;
4. verified readiness only after the Telnyx connection probe succeeds;
5. webhook signature validation;
6. duplicate event idempotency;
7. stale/out-of-order webhook does not regress call-session state;
8. newer provider event advances state;
9. emergency/SMS/inbound capabilities are not inferred;
10. TypeScript/build regression checks.

## Deployment and verification

Merge/deploy is not equivalent to provider verification.

After code CI passes:

1. deploy database migration and Edge Functions through the existing ATLAS deployment path;
2. configure organization-scoped Telnyx secrets in the existing server secret store;
3. run authenticated readiness against the deployed function;
4. originate one controlled non-emergency test call;
5. verify signed `call.initiated`, `call.answered` where applicable, and `call.hangup` evidence;
6. verify ATLAS session state matches the newest provider event;
7. run the ATLAS global production verifier and critical P0 routes;
8. only then mark Telnyx voice production-ready.

## Explicit non-goals

This slice does not claim or implement:

- ATLAS-owned carrier/RAN infrastructure;
- emergency calling;
- 10DLC campaign registration;
- production SMS/MMS;
- WhatsApp;
- number purchasing automation;
- eSIM provisioning;
- recording/transcription production enablement;
- satellite/NTN connectivity.

Those remain separate provider-neutral adapters or capability gates.
