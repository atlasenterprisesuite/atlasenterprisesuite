# ATLAS Mobile Experience Design

## Status
Approved in chat on 2026-10-04. This document defines the architectural direction for bringing the researched iOS/mobile product patterns into ATLAS without copying OpenAI branding, UI, proprietary implementation details, or unsupported platform capabilities.

## Objective
Create a governed ATLAS Mobile Experience that delivers a high-quality assistant, account/settings, privacy, diagnostics, billing, knowledge/help, and native-device capability layer for iPhone and iPad first, while preserving a reusable cross-platform architecture for Android and responsive web.

Success means ATLAS users can move through the core mobile experience without fake states, dead-end controls, duplicated identity/billing logic, or native capability claims that the current runtime cannot prove.

## Repository and Architecture Baseline
ATLAS already has an established architecture that must be extended rather than replaced:

- `apps/web` is the primary ATLAS application.
- Shared product capabilities live under existing `packages/*` domains.
- Apple-specific integrations already exist under `native/*` through focused bridges.
- Authentication, tenancy, RBAC, audit, provider readiness, and production verification are governed by the repository-wide ATLAS autonomous execution protocol.
- Cloudflare remains the primary web/edge delivery and public verification boundary.
- Supabase remains the preferred backend direction when database/auth/storage/backend services are needed.

This project must not create a parallel application shell, identity system, billing source of truth, audit system, or deployment architecture.

## Architectural Decision
Adopt a layered `ATLAS Mobile Experience` capability rather than a standalone cloned mobile app.

The canonical flow is:

`Mobile UI -> ATLAS Mobile Gateway -> Existing ATLAS Domains -> Provider/Native Adapters -> Audit + Evidence`

The mobile layer is responsible for presentation, device capability detection, mobile-specific workflows, and safe transport of actions into the existing ATLAS domains. Domain ownership stays where it already belongs.

### Layer 1 — Responsive ATLAS Mobile UI
Use the existing ATLAS web shell and responsive application architecture as the first delivery surface. It must provide mobile-first layouts for:

- Assistant
- Conversation history
- Account and profile settings
- Privacy and permissions
- Billing and plan visibility
- Diagnostics and support
- Knowledge/help
- Device capability status

This layer must work on iPhone/iPad browsers and installed web-app contexts without pretending to expose native-only APIs.

### Layer 2 — ATLAS Mobile Gateway
Introduce a narrow shared contract that normalizes mobile-specific state without duplicating domain logic.

Responsibilities:

- runtime/device capability snapshot
- mobile preference transport
- conversation sync cursors
- permission-evidence normalization
- native bridge result normalization
- diagnostic-bundle requests
- billing entitlement evidence normalization
- audit correlation IDs for mobile actions

The gateway is an orchestration boundary, not a new source of truth.

### Layer 3 — Existing ATLAS Domains
Reuse existing domains first:

- Assistant/intelligence behavior -> existing ATLAS assistant / AI core / copilot architecture
- Identity/session -> existing auth/core/security architecture
- Billing/entitlements -> existing finance/commerce/provider adapters where applicable
- Privacy/governance -> existing security/governance/compliance layers
- Knowledge/help -> existing knowledge domain
- Audit -> existing governance/audit mechanisms

A new package such as `packages/mobile-experience/` is permitted only if implementation inspection proves that shared mobile contracts do not cleanly belong in existing packages. The implementation plan must document that decision before creating the package.

### Layer 4 — Native Apple Bridges
Native integrations remain focused adapters under `native/*`.

Current Apple bridges must be reused where relevant. Additional native code may be added only when a capability cannot truthfully be delivered through the responsive web application.

Potential native-only responsibilities include:

- Apple-specific permission requests
- StoreKit entitlement/restore operations
- haptics
- native share sheet
- supported drag/drop or document interaction
- push notification registration
- deep links/universal links
- native microphone/camera/location capability probes
- locally available Apple accessibility/voice capabilities

The web app must render `Requires ATLAS iOS app` or `Unavailable in this runtime` when a native capability cannot be accessed.

## Product Scope

### 1. ATLAS Assistant Mobile
The mobile assistant must provide:

- new conversation
- conversation history
- search across available conversation metadata/content where authorized
- reopen/resume conversation
- rename/archive/delete when supported by the existing backend
- loading/empty/error/offline states
- explicit provider/readiness state when required
- responsive composer
- attachment entry points backed by real supported upload paths
- route continuity when returning from settings/help

Conversation history must reflect persisted data only. No fabricated example conversations may be rendered as production content.

### 2. ATLAS iPad Experience
Tablet behavior must use available screen space rather than stretching phone layouts.

Required patterns:

- split navigation/content where useful
- persistent or collapsible sidebar
- keyboard-friendly controls
- pointer/hover support where applicable
- drag/drop only when the runtime can actually support it
- multi-column settings/help layouts where appropriate

Any drag/drop capability must expose a truthful unsupported state when browser/native APIs are unavailable.

### 3. Account and Settings
The mobile settings surface must consolidate account-level controls rather than scattering them across modules.

Recommended routes:

- `/settings/account`
- `/settings/preferences`
- `/settings/privacy`
- `/settings/security`
- `/settings/billing`
- `/settings/diagnostics`
- `/settings/about`

Required behavior:

- show persisted values only
- save through real APIs
- validate forms
- indicate save success/failure
- expose version/build metadata where available
- separate user preferences from organization/tenant policy
- disable tenant-controlled settings when the user lacks permission

### 4. Identity Diagnostics
Identity diagnostics must help explain sign-in/session failures without exposing secrets.

Signals may include:

- authenticated / unauthenticated
- session present / expired / unknown
- identity provider label when available
- device/runtime capability
- cookie/storage availability where relevant
- tenant/org resolution state
- MFA/AAL evidence if already exposed safely by the identity layer
- clock/network hints when detectable

Identity diagnostics must never show raw tokens, cookies, recovery codes, secret headers, or provider credentials.

States must be factual:

- `verified`
- `unverified`
- `expired`
- `unavailable`
- `error`

Unknown evidence must not be rendered as verified.

### 5. Privacy Center
The mobile privacy center owns presentation of consent and device-permission state but not the underlying provider/system permission mechanism.

Permission states:

- `granted`
- `denied`
- `restricted`
- `not_determined`
- `unsupported`
- `unknown`

Supported categories may include:

- microphone
- camera
- photos/files
- location
- notifications
- local device integrations

Rules:

- request only at point of use unless a documented product requirement justifies earlier consent
- explain why the permission is needed before requesting it
- store only the minimum evidence needed for product state/audit
- never infer system permission from a prior app-level toggle
- destructive privacy/data actions require explicit confirmation
- tenant policy cannot silently override OS-level consent

### 6. Billing Center
ATLAS billing must expose current entitlement evidence without assuming that plan state is valid merely because a UI button was pressed.

Recommended billing states:

- `active_verified`
- `trial_verified`
- `past_due_verified`
- `canceled_verified`
- `pending`
- `unverified`
- `provider_error`
- `unsupported_runtime`

Rules:

- web billing continues through existing authorized billing/provider paths
- StoreKit is used only in an actual Apple-native runtime where ATLAS owns or is authorized to expose the purchase flow
- restore-purchase actions must return provider evidence before showing `restored`
- no UI may show `paid`, `active`, `restored`, or equivalent success labels without authenticated provider evidence
- billing state must be associated with the correct ATLAS user/account/tenant scope
- provider receipts or sensitive billing tokens must remain server-side

### 7. Support Diagnostics
Create a user-visible diagnostics workflow that can gather a safe support bundle.

Potential fields:

- ATLAS app/web version
- commit/build identifier if available
- runtime/browser/native app version
- OS family/version where safely detectable
- device class
- locale/timezone
- network reachability summary
- route
- correlation/request IDs
- recent sanitized client errors
- feature/provider readiness summary
- auth/session status classification without secrets

Before submission/export:

- redact tokens, authorization headers, cookies, passwords, API keys, recovery codes, message content unless specifically included by the user, and other secrets
- provide a preview of categories collected
- require explicit user action before transmitting a support bundle externally

### 8. Knowledge and Help
ATLAS Knowledge must turn the mobile research findings into contextual help instead of cloning the OpenAI Help Center.

Required behavior:

- topic-based mobile help
- contextual links from settings/errors
- searchable help index
- troubleshooting decision paths
- platform capability explanations
- distinction between web, iPhone, iPad, and future Android behavior
- version/freshness metadata for ATLAS-owned guidance

Help content must describe actual ATLAS behavior. External references may be cited for platform facts, but ATLAS must not present third-party instructions as if they were ATLAS implementation evidence.

## Core Domain Contracts
The following contracts define the mobile boundary regardless of their final package location.

### `MobileRuntimeSnapshot`
Fields:

- `runtime`: `web | ios_native | ipad_native | android_native | unknown`
- `deviceClass`: `phone | tablet | desktop | unknown`
- `osFamily`
- `osVersion` when available
- `appVersion`
- `buildId`
- `capabilities`
- `capturedAt`

### `MobileCapabilityState`

- `supported`
- `unsupported`
- `restricted`
- `unknown`
- `error`

Each capability should carry source/evidence metadata when it influences a sensitive action.

### `MobilePermissionEvidence`

- permission type
- normalized state
- source: `browser | ios | ipad | android | atlas_policy`
- observed timestamp
- scope
- optional reason/error code

### `BillingEntitlementSnapshot`

- provider
- product/plan identifier
- normalized state
- user/account scope
- provider evidence timestamp
- verification source
- last verified at

### `DiagnosticBundle`

- bundle version
- generated timestamp
- runtime snapshot
- sanitized errors
- readiness summary
- correlation IDs
- user-selected optional details
- redaction result

### `ConversationSyncCursor`

- user/account scope
- latest seen message/conversation revision
- server timestamp
- pagination cursor
- conflict/resync indicator

## Authorization and RBAC
Mobile presentation never weakens the existing ATLAS authorization model.

Recommended permission vocabulary, subject to reuse/generalization of existing permission patterns:

- `mobile.settings.read`
- `mobile.settings.update`
- `mobile.privacy.read`
- `mobile.privacy.update`
- `mobile.diagnostics.read`
- `mobile.diagnostics.export`
- `mobile.billing.read`
- `mobile.billing.manage`
- `mobile.support.submit`

Assistant and knowledge actions should continue to use their owning domain permissions instead of duplicating them under `mobile.*`.

Tenant/org isolation must be enforced server-side. Client-side route guards are additive UX controls, not security boundaries.

## Audit Requirements
Audit sensitive mobile actions such as:

- permission state changes known to ATLAS
- privacy setting changes
- support bundle generation/submission
- billing restore/manage actions
- account/security changes
- destructive conversation/data actions

Audit events must contain metadata only and must not capture raw secrets or full sensitive user content.

## Fail-Closed Rules
The mobile experience must fail closed for high-trust states.

Examples:

- missing billing evidence -> `unverified`, not `active`
- missing identity evidence -> `unverified`, not `verified`
- unknown OS permission -> `unknown`, not `granted`
- unsupported native API -> `unsupported_runtime`, not simulated success
- failed restore purchase -> retain prior verified state and show error
- expired/stale provider snapshot -> display stale/unverified state until refreshed

These rules align with the ATLAS governance requirement that connected/approved/paid/signed/printed/shipped/fulfilled-style states must not appear without authenticated evidence.

## Offline and Connectivity Behavior
Mobile clients may experience intermittent connectivity.

Required behavior:

- distinguish offline from server error
- preserve unsent text locally only where permitted and safe
- do not mark mutations successful before server acknowledgement
- retry idempotent reads automatically where appropriate
- avoid automatic retry for destructive or payment actions unless the backend supplies an idempotency contract
- display stale-data indicators when cached state is shown

## Security and Privacy Controls

- no secrets in browser bundles, native logs, diagnostics exports, analytics payloads, or support bundles
- sanitize error messages before user/export display
- use server-side provider calls for privileged billing/auth/provider operations
- preserve CSRF/session protections for web
- use secure native storage only for native secrets/tokens that cannot remain server-side
- avoid persisting sensitive message content in generic mobile telemetry
- use explicit consent before collecting optional diagnostics
- preserve tenant/user scoping in every mobile endpoint

## Accessibility
Mobile experiences must support:

- screen readers
- semantic labels
- dynamic text sizing where technically supported
- sufficient focus visibility
- keyboard navigation on iPad/desktop contexts
- non-color status communication
- reduced-motion preferences where applicable
- captions/transcripts for supported voice/media interactions

Native accessibility enhancements may be added through focused platform bridges rather than hard-coded web assumptions.

## Observability
Mobile actions should emit privacy-safe telemetry with correlation IDs for:

- route load failures
- auth/session failures
- provider verification failures
- permission request outcomes
- billing verification/restore outcomes
- diagnostic bundle generation
- conversation sync conflicts

Observability must distinguish application bugs from provider/network/authorization failures.

## UX State Model
Every interactive mobile screen must support the relevant states:

- loading
- empty
- ready
- disabled
- unsupported
- restricted
- offline
- error
- success
- stale/unverified where evidence matters

Buttons must not be decorative. Every visible control must navigate or execute a real supported action.

## Route Strategy
Reuse existing routes when present. Do not create duplicate mobile-only route trees unless native routing requires it.

Candidate additions or extensions:

- `/assistant`
- `/assistant/history`
- `/settings/account`
- `/settings/preferences`
- `/settings/privacy`
- `/settings/security`
- `/settings/billing`
- `/settings/diagnostics`
- `/settings/about`
- `/knowledge/mobile`
- `/support/diagnostics`

The implementation plan must inspect the current route tree and map these capabilities to existing routes before creating new ones.

## Native App Boundary
A dedicated native iOS host application is justified only when one or more approved requirements cannot be achieved safely through the current responsive web application and existing focused bridges.

If created, it must:

- reuse ATLAS auth/backend contracts
- reuse existing domain APIs
- not fork business logic
- not introduce a separate billing source of truth
- not duplicate analytics/audit systems
- expose a runtime capability contract back to ATLAS
- use universal/deep links that resolve to canonical ATLAS routes

The implementation plan must explicitly prove the need before adding `apps/ios` or another native app root.

## Delivery Phases

### Phase 0 — Repository Inventory and Mapping
- map current assistant/history/settings/help/billing/security routes
- map existing auth/session APIs
- map existing billing/commerce provider adapters
- map knowledge and audit utilities
- map Apple native bridges
- identify reusable components/hooks/schemas

### Phase 1 — Responsive Mobile Foundation
- mobile layout refinements in `apps/web`
- consolidated settings surfaces
- mobile runtime/capability contract
- privacy and diagnostics read surfaces
- truthful unsupported/native-required states
- contextual mobile knowledge/help

### Phase 2 — Mobile Actions and Evidence
- real preference persistence
- permission evidence normalization
- safe diagnostics bundle generation
- billing entitlement verification surfaces
- conversation sync/history improvements
- audit coverage

### Phase 3 — Native Apple Extensions
Only where justified by implementation evidence:

- StoreKit adapter
- notification registration
- haptics
- native share/deep-link integrations
- OS permission bridge
- supported iPad drag/drop/document features

### Phase 4 — Cross-Platform Reuse
- reuse mobile contracts for Android
- preserve shared backend/domain behavior
- add Android-specific native adapters only where required

## Testing Strategy

### Unit tests
- state normalization
- billing evidence normalization
- permission normalization
- diagnostic redaction
- runtime capability parsing
- stale/unknown/fail-closed behavior

### Integration tests
- settings persistence
- auth/session diagnostics
- tenant isolation
- billing provider verification path
- conversation history/search
- support bundle generation
- knowledge contextual links
- audit emission

### UI tests
- phone viewport
- tablet/iPad viewport
- desktop regression
- offline state
- slow network
- denied permission
- provider unavailable
- stale entitlement
- unauthenticated session

### Security tests
- no secrets in diagnostics
- no cross-tenant access
- server enforcement for sensitive actions
- no false verified/paid/granted states

## Production Verification
Before this capability can be marked complete:

1. `npm ci`
2. `npm run typecheck`
3. `npm test`
4. `npm run build`
5. verify affected mobile routes do not return 404/500
6. verify iPhone-size responsive behavior
7. verify iPad/tablet responsive behavior
8. verify identity/permission/billing unknown states fail closed
9. verify real settings persistence
10. verify diagnostics redaction
11. verify tenant/RBAC boundaries
12. merge through canonical Git path
13. deploy through the authorized Cloudflare path for web changes
14. verify the public production route against the exact deployed revision
15. verify native behavior only on an actual supported Apple runtime before claiming native readiness

Source code or successful local tests alone are not production evidence.

## Non-Goals

- cloning ChatGPT/OpenAI branding or UI verbatim
- claiming parity with ChatGPT features that ATLAS does not implement
- fabricating Apple-native support in the web runtime
- introducing a second ATLAS identity system
- introducing a second billing ledger/source of truth
- logging sensitive conversation content as generic diagnostics
- bypassing tenant/RBAC controls for mobile convenience
- showing optimistic success states before backend/provider acknowledgement

## Acceptance Criteria
The design is considered implemented only when:

- mobile assistant/history/settings/help routes are functional and responsive
- mobile actions use real ATLAS backend/domain contracts
- account and privacy settings persist and reload correctly
- identity diagnostics are useful without exposing secrets
- permission state is normalized truthfully
- billing state is provider-evidence-backed
- support diagnostics are previewable and redacted
- mobile help is contextual and ATLAS-specific
- iPad layouts are intentionally adapted, not merely scaled
- unsupported native capabilities are clearly labeled
- RBAC/tenant/audit boundaries are verified
- applicable automated tests pass
- canonical build passes
- production web deployment is verified at exact revision
- native readiness is claimed only after device/runtime verification

## Implementation Planning Constraints
The implementation plan must:

1. inspect before adding any route/package/bridge;
2. list exact existing files to reuse;
3. avoid broad refactors unrelated to this capability;
4. use test-driven development for code changes;
5. split work into reviewable increments;
6. keep native work behind explicit capability boundaries;
7. preserve fail-closed evidence rules;
8. end with exact production verification evidence rather than a source-only completion claim.

## Decision Summary
ATLAS will adopt the strongest mobile product patterns from the researched iOS experience as governed ATLAS capabilities: clear assistant continuity, consolidated settings, privacy transparency, diagnostics, billing evidence, contextual help, and intentional iPhone/iPad UX. The implementation will extend the existing ATLAS ecosystem and Apple bridge architecture rather than cloning another product or creating a parallel mobile stack.
