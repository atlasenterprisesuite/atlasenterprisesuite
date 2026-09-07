# ATLAS Connect + WhatsApp Channels Design

## Status
High-level direction approved in chat on 2026-09-06. Detailed design committed for user review before implementation.

## Objective
Integrate the official `Atlas Enterprise Suite News` WhatsApp Channel into ATLAS as a real publishing destination while preserving provider truth.

Official channel:
- Name: `Atlas Enterprise Suite News`
- URL: `https://whatsapp.com/channel/0029VbDVlpzFcowFQpPHTR32`

ATLAS must prepare channel-ready content now, expose the real delivery capability state, record manual publication evidence, and later upgrade the same destination contract to automated publishing only when an authorized provider exposes and proves a supported Channel publishing action.

## Ownership
- Primary owner: `ATLAS Connect`
- Authoring surface: `ATLAS Creator Studio`
- Secondary integrations: `ATLAS Automations`, `ATLAS Security`, `ATLAS Manager`, analytics
- ATLAS Connect owns destination definitions, capability state, publication requests, adapters, receipts, and audit.
- Creator Studio owns composition, preview, destination validation, scheduling intent, and publish/review UX.
- Provider code stays behind adapters. Creator Studio never calls Peach, Meta, or another provider directly.

## Current Repository Fit
The canonical app is React/Vite with `react-router-dom`, one ATLAS shell, and an explicit rule that only implemented routes are shown as active. The current canonical tree has no working Creator Studio or ATLAS Connect route and no production auth/session/database layer for this domain.

This slice therefore establishes a minimal reusable publishing boundary inside the existing app. It does not create another application or pretend a production backend already exists.

## Architecture
Use a capability-driven destination flow:

`Creator Studio -> Publish Intent -> ATLAS Connect Registry -> Capability Check -> Adapter/Handoff -> Receipt -> Audit`

WhatsApp Channels starts in `manual_handoff` mode because the currently connected Peach WhatsApp Business tooling exposes messaging, templates, contacts, campaigns, automations, and agents but no WhatsApp Channel publication action.

A destination may move to `provider_publish` only after an authorized adapter demonstrates a supported Channel publish action and ATLAS can verify a provider receipt or status.

## Core Contracts
```ts
type PublicationCapability = 'manual_handoff' | 'provider_publish' | 'unavailable';
type PublicationStatus =
  | 'draft'
  | 'ready'
  | 'awaiting_manual_publish'
  | 'publishing'
  | 'published'
  | 'failed';

type ReceiptVerification = 'manual_confirmation' | 'provider_verified';

interface PublishDestination {
  id: string;
  platform: 'whatsapp_channel' | 'whatsapp_business' | 'instagram' | 'facebook' | 'x' | 'other';
  name: string;
  capability: PublicationCapability;
  publicUrl?: string;
  provider?: string;
}
```

No destination is represented as `connected`, `live`, or `published` from configuration alone.

## Routes
- `/studio`
- `/studio/publish`
- `/connect`
- `/connect/destinations`
- `/connect/destinations/whatsapp-channel`
- `/connect/publications`

Primary flow:
`Enterprise -> Creator Studio -> Publish -> WhatsApp Channel -> Review -> Handoff/Publish -> Receipt`

Operations flow:
`Enterprise -> ATLAS Connect -> Destinations -> WhatsApp Channel -> Capability + Audit`

## Creator Studio UX
The initial publish surface supports:
- internal title/label
- text body
- link
- image/video attachment metadata when available
- destination selection
- destination readiness checks
- WhatsApp Channel preview
- save draft
- mark ready
- publish/handoff based on real capability
- receipt/status view

For WhatsApp Channels, the contract recognizes text, links, images, videos, audio, and polls. A type stays disabled until the current ATLAS authoring surface can represent and validate it truthfully.

## Manual Handoff Behavior
While capability is `manual_handoff`, the action is `Open WhatsApp Channel to publish`, never `Publish automatically`.

The flow must:
1. validate the exact reviewed content;
2. persist the draft and destination snapshot;
3. calculate a stable content fingerprint;
4. open the official channel URL;
5. transition to `awaiting_manual_publish`;
6. require an authorized explicit confirmation before marking `published`;
7. write a receipt with `verification: 'manual_confirmation'`;
8. record actor, timestamp, destination, fingerprint, and optional update reference;
9. never infer publication merely because WhatsApp was opened.

## Destination Registry
Initial WhatsApp Channel state:
```ts
{
  platform: 'whatsapp_channel',
  capability: 'manual_handoff',
  provider: 'none_verified_for_channel_publish',
  publicUrl: 'https://whatsapp.com/channel/0029VbDVlpzFcowFQpPHTR32'
}
```

Peach remains a valid WhatsApp Business messaging integration, but it must not be labeled as a WhatsApp Channels publisher unless its exposed capability changes and is verified.

## Persistence Decision for This Slice
Because the canonical repo currently has no production persistence/auth layer for Connect, the first implementation uses a versioned browser-local repository adapter, for example `atlas.connect.dev.v1`, behind a storage interface.

Rules:
- UI must display `Development local persistence — not tenant-safe production storage`.
- Store only drafts, destination snapshots, attempts, receipts, and audit events needed for this slice.
- Never store provider tokens, cookies, passwords, WhatsApp session material, or secrets.
- Storage contracts must be replaceable by a future server/Supabase adapter without changing Creator Studio components.
- Local persistence is acceptable evidence for UI/state behavior only; it is not production persistence evidence.

Required record concepts:
- `PublishDraft`
- `PublishDestinationSnapshot`
- `PublicationAttempt`
- `PublicationReceipt`
- `PublicationAuditEvent`

## Authorization Boundary
The canonical repo has no production identity/authorization service for this domain, so this slice must not invent one.

Create a permission interface with development capability state clearly labeled. External automated publication remains disabled unless a real authorization adapter is present.

Permission concepts:
- `studio.draft.create`
- `studio.draft.edit`
- `connect.destination.read`
- `connect.publish.request`
- `connect.publish.confirm_manual`
- `connect.publish.retry`
- `connect.audit.read`

A future server/provider adapter must re-check authorization server-side.

## Audit
Record:
- actor label available in the current environment
- organization/tenant only when actually available
- publication id
- destination id
- capability mode
- content fingerprint
- action
- timestamp
- outcome
- receipt verification type
- provider reference when available
- error code/message on failure

`handoff_started` is not `published`.

## Validation and State Rules
Before `ready`:
- destination exists
- content is non-empty
- selected content type is supported
- required attachment metadata exists
- links are syntactically valid
- content fingerprint exists

Before automated `published`:
- capability is `provider_publish`
- real authorization passes
- provider returns verifiable success evidence
- receipt uses `provider_verified`

Before manual `published`:
- prior state is `awaiting_manual_publish`
- authorized actor explicitly confirms completion
- audit event is written
- receipt uses `manual_confirmation`

Explicit UI states include: no destinations, manual-only, provider unavailable, permission denied, validation failed, awaiting manual confirmation, failed, published/manual evidence, and published/provider verified.

## Testing
Unit:
- capability resolution
- status transition state machine
- validation
- fingerprint stability
- permission adapter behavior
- manual confirmation requirements

Integration:
- draft -> ready -> manual handoff -> awaiting confirmation
- explicit confirmation -> published + receipt + audit
- opening WhatsApp does not equal publication
- provider failure cannot produce `published`
- unauthorized actions fail closed
- unavailable destination renders truthfully
- local storage round-trip preserves exact fingerprinted draft

Web:
- all new routes render without 404
- forward/back navigation works
- destination selection changes preview/state
- loading/disabled/error/success states render
- mobile/tablet/desktop remain usable

Repository gates:
- `npm run typecheck`
- `npm test`
- `npm run build`
- existing consensus/security CI required by canonical governance

## Security and Privacy
- Never automate logged-in WhatsApp Web through scraping or session theft.
- Never expose admin phone numbers through Channel data.
- Treat Channel updates as public content and warn before final handoff/publish.
- Secrets for any future provider adapter belong in the governed ATLAS Manager infrastructure path, never committed code or browser storage.

## Production Truth Boundary
After this slice passes code/tests/build/navigation, it may be called `implemented` and the Channel may be called `configured for manual handoff`.

It must NOT be called `automatically connected` or `automated publishing live` until an authorized provider adapter publishes a real test update and ATLAS verifies the provider result.

## Implementation Sequence
1. Provider-neutral publish contracts and state machine.
2. Local development repository adapter and truthful environment banner.
3. ATLAS Connect destination registry with the official Channel in `manual_handoff`.
4. Creator Studio routes, compose form, destination preview, and validation.
5. Manual handoff, explicit confirmation, receipt, and audit.
6. Permission interface and fail-closed provider-publish gate.
7. Unit/integration/web tests.
8. Typecheck, tests, build, CI, review PR.
9. Merge only after gates pass; deploy through the canonical production chain and verify runtime separately.
10. Add automated Channel provider adapter later only when a supported API and authorization are actually available.

## Non-Goals
- No WhatsApp Web scraping/automation.
- No fabricated followers, reach, reactions, or engagement metrics.
- No Instagram/Facebook/X publishing in this slice; only extensible contracts.
- No new repository or parallel ATLAS app.
- No blind migration of historical Creator Studio code from legacy repositories.
- No bypass of CI, review, audit, or production verification.
