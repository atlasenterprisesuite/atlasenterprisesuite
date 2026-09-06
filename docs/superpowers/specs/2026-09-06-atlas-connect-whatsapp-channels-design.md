# ATLAS Connect + WhatsApp Channels Design

## Status
High-level direction approved in chat on 2026-09-06. This detailed design is committed for review before implementation.

## Objective
Integrate the official `Atlas Enterprise Suite News` WhatsApp Channel into the ATLAS publishing architecture without pretending that the current provider connection can publish to WhatsApp Channels when that capability has not been proven.

ATLAS must be able to prepare channel-ready content now, expose the real delivery capability state, record human publication evidence, and later promote WhatsApp Channels to automated publishing through the same destination contract when an authorized provider exposes a supported channel-publish API.

Official channel reference:
- Name: `Atlas Enterprise Suite News`
- Public channel URL: `https://whatsapp.com/channel/0029VbDVlpzFcowFQpPHTR32`

## Ownership and Module Classification
- Primary owner: `ATLAS Connect`
- Authoring surface: `ATLAS Creator Studio`
- Secondary integrations: `ATLAS Automations`, `ATLAS Security`, `ATLAS Manager`, analytics/engagement surfaces
- ATLAS Connect owns destination definitions, capability state, publication requests, provider adapters, delivery receipts, and audit events.
- Creator Studio owns composition, preview, destination-specific validation, scheduling intent, and the publish/review UX.
- Provider-specific code must remain behind adapters. Creator Studio must not call Peach, Meta, or another provider directly.

## Current Repository Fit
The canonical web app uses one React/Vite shell and `react-router-dom`, and only exposes implemented routes as active. This feature must extend that shell rather than create a parallel ATLAS application.

The current canonical tree does not yet expose a working Creator Studio or ATLAS Connect route. Therefore the first implementation must establish a minimal reusable publishing boundary rather than copy historical code blindly or invent a separate product.

## Architecture Decision
Adopt a capability-driven destination architecture.

Flow:

`Creator Studio -> Publish Intent -> ATLAS Connect Destination Registry -> Capability Check -> Adapter -> Delivery Receipt -> Audit`

WhatsApp Channels starts in `manual_handoff` capability mode because the currently connected Peach WhatsApp Business tooling exposes messages, templates, contacts, campaigns, automations, and agents but no WhatsApp Channel publication action.

The destination may move to `provider_publish` only after an authorized adapter demonstrates a supported channel publication action and returns verifiable provider receipts.

## Destination Contract
Create a provider-neutral destination model with at least:

```ts
type PublicationCapability =
  | 'manual_handoff'
  | 'provider_publish'
  | 'unavailable';

type PublicationStatus =
  | 'draft'
  | 'ready'
  | 'awaiting_manual_publish'
  | 'publishing'
  | 'published'
  | 'failed';

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

## Initial Routes
Create the route family in the canonical shell:

- `/studio`
- `/studio/publish`
- `/connect`
- `/connect/destinations`
- `/connect/destinations/whatsapp-channel`
- `/connect/publications`

Initial navigation depth:

`Enterprise -> Creator Studio -> Publish -> WhatsApp Channel -> Review -> Handoff/Publish -> Receipt`

and

`Enterprise -> ATLAS Connect -> Destinations -> WhatsApp Channel -> Capability + Audit`

## Creator Studio Publish UX
The initial publish page must support:
- title/internal label
- text body
- link
- image/video attachment metadata when available
- destination selection
- destination readiness checks
- preview for WhatsApp Channel
- save draft
- mark ready
- publish/handoff action based on real capability
- final receipt/status view

For WhatsApp Channels, support the content families documented by WhatsApp for channel updates where the local authoring environment can represent them truthfully: text, links, images, videos, audio, and polls. Unsupported authoring types stay disabled rather than simulated.

## WhatsApp Channel Manual Handoff
While capability is `manual_handoff`, the primary action is `Open WhatsApp Channel to publish` rather than `Publish automatically`.

The handoff must:
1. validate the prepared content;
2. preserve the draft and destination snapshot;
3. open the official channel URL;
4. move the ATLAS publication to `awaiting_manual_publish`;
5. allow the user/admin to record publication completion explicitly;
6. record timestamp, actor, destination, content fingerprint, and optional provider/update reference if supplied;
7. never infer publication merely because the WhatsApp page was opened.

A future provider adapter may replace steps 3-6 with an authenticated publish call plus receipt verification without changing Creator Studio's publish intent contract.

## Capability Registry
ATLAS Connect must expose provider truth separately from product intent.

Example WhatsApp Channel state for the current environment:

```ts
{
  platform: 'whatsapp_channel',
  capability: 'manual_handoff',
  provider: 'none_verified_for_channel_publish',
  publicUrl: 'https://whatsapp.com/channel/0029VbDVlpzFcowFQpPHTR32'
}
```

Peach remains usable for WhatsApp Business messaging capabilities, but its current connection must not be mislabeled as a WhatsApp Channels publisher.

## Data Model
First implementation may use a repository-backed development store only if the project has no configured production persistence for this domain. It must be clearly labeled development/demo state.

Required records:
- `PublishDraft`
- `PublishDestinationSnapshot`
- `PublicationAttempt`
- `PublicationReceipt`
- `PublicationAuditEvent`

A publication stores a content fingerprint so the receipt can be tied to the exact reviewed content.

Do not persist provider secrets, access tokens, cookies, or personal WhatsApp session material in publication records.

## Permissions
Minimum permission concepts:
- `studio.draft.create`
- `studio.draft.edit`
- `connect.destination.read`
- `connect.publish.request`
- `connect.publish.confirm_manual`
- `connect.publish.retry`
- `connect.audit.read`

Destructive or externally visible publishing actions must be authorization-gated. A future automated provider adapter must re-check authorization server-side rather than trusting UI state.

## Audit
Record at least:
- actor
- tenant/organization scope when available
- draft/publication id
- destination id
- capability mode
- content fingerprint
- action
- timestamp
- outcome
- provider receipt/reference when available
- error code/message when failed

Opening a channel link is a `handoff_started` event, not a `published` event.

## Error and Empty States
Explicit states:
- no destinations configured
- destination available for manual handoff only
- provider adapter unavailable
- permission denied
- validation failed
- publication failed
- publication awaiting manual confirmation
- published with verified receipt
- published with user-recorded manual evidence

Do not collapse these into one generic success state.

## Validation Rules
Before `ready`:
- destination exists
- content is non-empty
- selected media type is supported by that destination contract
- required attachment metadata exists
- links are syntactically valid when present
- content fingerprint is generated

Before automated `published`:
- provider capability is `provider_publish`
- authorization passes
- provider returns a success receipt or a verifiable provider status

Before manually confirmed `published`:
- publication was in `awaiting_manual_publish`
- an authorized actor explicitly confirms completion
- audit record is written

## Testing
Unit tests:
- destination capability resolution
- status transition reducer/state machine
- validation rules
- content fingerprint stability
- permission checks
- manual confirmation requirements

Integration tests:
- draft -> ready -> manual handoff -> awaiting confirmation
- explicit confirmation -> published + receipt + audit
- opening WhatsApp does not equal publication
- provider failure does not produce published state
- unauthorized publish/confirm attempts fail closed
- unavailable destination produces truthful disabled state

Web tests:
- routes render without 404
- navigation forward/back works
- destination selection changes preview/state
- loading/disabled/error/success states render
- desktop/tablet/mobile layouts remain usable

Repository gates:
- `npm run typecheck`
- `npm test`
- `npm run build`
- relevant consensus/security checks already required by canonical CI

## Security and Privacy
- Never store WhatsApp credentials in browser state or committed code.
- Never scrape or automate a logged-in personal WhatsApp session as a substitute for an authorized provider API.
- Do not expose admin phone numbers through channel data.
- Treat channel updates as public content and show a public-content warning before final publish/handoff.
- Provider secrets, when a future adapter exists, belong in the existing governed secret/infrastructure path controlled by ATLAS Manager.

## Production Truth Boundary
The feature can be called `implemented` after code, tests, build, navigation, and audit behavior pass.

The WhatsApp Channel can be called `configured for manual handoff` once its official URL is present and the handoff flow is verified.

It must NOT be called `automatically connected` or `automated publishing live` until a real authorized provider adapter publishes a test update and ATLAS verifies the resulting provider receipt/state.

## Implementation Sequence
1. Add provider-neutral publish contracts and state machine.
2. Add the ATLAS Connect destination registry with the official WhatsApp Channel in truthful `manual_handoff` state.
3. Add Creator Studio publish routes and destination preview.
4. Add manual handoff + explicit confirmation receipt flow.
5. Add audit and permission boundaries.
6. Add unit/integration/web tests.
7. Run typecheck, tests, build, and CI.
8. Open review PR; merge only after gates pass.
9. Deploy through the canonical production chain and verify routes/runtime separately.
10. Later, add a provider adapter for automatic WhatsApp Channel publishing only when a supported API and authorization are actually available.

## Non-Goals for This Slice
- Do not automate WhatsApp Web through browser/session scraping.
- Do not fabricate channel follower/engagement metrics.
- Do not publish to Instagram/Facebook/X in this slice; the destination contract must simply remain extensible to them.
- Do not create a separate ATLAS app or repository.
- Do not migrate historical Creator Studio code blindly from the inaccessible legacy repository.
- Do not bypass canonical CI, review, audit, or production verification.
