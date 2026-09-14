# ATLAS Hospitality U.S. Operations + Controlled Hotel-Key Validation — Design Specification

Date: 2026-09-14
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Target branch: `feat/hospitality-us-ops-key-validation`
Owner module: `Hospitality`
Secondary modules: `Execution`, `Identity`, `Security`, `Audit`, `Accounting`, `Finance`, `Inventory`, `Vendors`, `Projects`, `CRM`, `ATLAS Assistant`, `ATLAS Pay`

## 1. Purpose

ATLAS Hospitality is a configurable hospitality operating and intelligence layer for hotel chains, management companies, ownership groups, portfolios, resorts, independent hotels, and mixed-brand hospitality organizations in the United States.

Crowne Plaza Orlando is a possible reference pilot property, not the architecture of the product. The same core must support other U.S. chains and properties without brand-specific forks.

The system extends the existing ATLAS Hospitality implementation already present in `main`, including multi-provider Room Access. It must not create a parallel Hospitality product, identity silo, tenant model, workflow engine, approval system, audit system, or assistant.

The product sequence is:

`Discovery -> Current-State Map -> Property Operating Model -> Staff Connect / Guest Requests -> Guest Entitlements -> Events & Catering -> Integrations -> KPI Baseline -> 60-Day Pilot -> Evidence Dashboard -> Executive Review -> Portfolio Expansion -> Controlled Hotel-Key Validation`.

## 2. Scope and market model

Initial market scope is the United States, but core records remain internationalizable.

Defaults may use:

- country: US;
- currency: USD;
- U.S. state/region vocabulary;
- U.S. operational and privacy requirements where applicable.

Core records must still retain configurable country, region, timezone, currency, locale, language, measurement preferences, address structure, tax references, and accessibility settings so the architecture is not U.S.-locked.

ATLAS must support:

- large international chains operating in the U.S.;
- national and regional chains;
- ownership groups;
- management companies;
- franchised properties;
- independently operated hotels;
- resorts;
- select-service and full-service hotels;
- extended-stay properties;
- luxury, lifestyle, boutique, convention, and airport properties;
- multi-brand portfolios.

## 3. Enterprise relationship model

Never assume `Brand = Owner = Operator = Property`.

Canonical relationship graph:

`ATLAS Organization/Tenant -> Hospitality Business Entities -> Portfolio -> Property -> Department / Outlet / Space -> Workflow / Record`.

Hospitality business entities may represent:

- owner;
- operator;
- management company;
- franchisor;
- brand group;
- vendor;
- other approved relationship types.

A property can retain multiple business relationships simultaneously, each with its own effective dates and status.

Core entities:

### `hospitality_brands`

- `id uuid`
- `brand_key text`
- `display_name text`
- `parent_brand_id uuid nullable`
- `brand_family text nullable`
- `market_segment text nullable`
- `status text`
- metadata and timestamps

### `hospitality_business_entities`

- `id uuid`
- `atlas_org_id uuid`
- `entity_type text`
- `display_name text`
- `external_reference text nullable`
- `status text`
- timestamps

### `hospitality_property_relationships`

- `property_id uuid`
- `business_entity_id uuid`
- `relationship_type text`
- `starts_at timestamptz nullable`
- `ends_at timestamptz nullable`
- `status text`

Changes in ownership, management, operation, or brand affiliation must not force creation of a replacement property record or destroy historical evidence.

## 4. Property operating model

The property is the primary Hospitality data and authorization boundary beneath the ATLAS organization.

### `hospitality_portfolios`

- `id uuid`
- `org_id uuid`
- `portfolio_key text`
- `display_name text`
- `status text`
- timestamps
- unique `(org_id, portfolio_key)`

### `hospitality_properties`

- `id uuid`
- `org_id uuid`
- `portfolio_id uuid nullable`
- `brand_id uuid nullable`
- `property_key text`
- `display_name text nullable`
- `country_code text`
- `region_code text nullable`
- `timezone text nullable`
- `currency text nullable`
- `locale text nullable`
- `status text`
- timestamps
- unique `(org_id, property_key)`

Existing Room Access `property_id text` values are treated as `property_key` during compatibility migration. The existing string contract is not destructively converted in the first migration.

### `hospitality_departments`

- `id uuid`
- `org_id uuid`
- `property_id uuid`
- `code text`
- `display_name text`
- `status text`
- timestamps
- unique `(property_id, code)`

No specific hotel's department names are hard-coded as production truth.

### `hospitality_rooms`

- `id uuid`
- `org_id uuid`
- `property_id uuid`
- `room_key text`
- `display_label text nullable`
- `floor text nullable`
- `status text`
- timestamps
- unique `(property_id, room_key)`

Existing `hospitality_room_mappings.atlas_room_id` remains compatible and is progressively reconciled to canonical `hospitality_rooms.room_key`.

## 5. Membership and authorization

Organization membership is necessary but not sufficient for ordinary property access.

### `hospitality_property_memberships`

- `id uuid`
- `org_id uuid`
- `property_id uuid`
- `user_id uuid`
- `role text`
- `status text`
- `starts_at timestamptz nullable`
- `ends_at timestamptz nullable`
- timestamps

### `hospitality_department_memberships`

- `id uuid`
- `property_membership_id uuid`
- `department_id uuid`
- `role text`
- `status text`
- timestamps

Authorization path:

`authenticated user -> active organization membership -> authorized property scope -> optional department scope -> required Hospitality permission -> action`.

Organization-level `owner`, `admin`, and `platform_admin` may receive explicit corporate scope according to existing ATLAS governance. Regular members do not inherit all properties automatically.

## 6. Hospitality permission families

Existing `hospitality.access.*` permissions remain valid.

Add or normalize capability families:

- `hospitality.property.*`
- `hospitality.staff.*`
- `hospitality.requests.*`
- `hospitality.entitlements.*`
- `hospitality.events.*`
- `hospitality.analytics.*`
- `hospitality.integrations.*`
- `hospitality.pms.*`
- `hospitality.wallet.*`
- `hospitality.access.*`

Sensitive writes require server-side authorization and audit. High-risk overrides may require ATLAS Approval Center.

## 7. Universal Execution Engine integration

Hospitality owns hotel business meaning. Universal Execution owns work orchestration.

Pattern:

`Hospitality Domain Record -> Execution Workflow -> Task -> Step -> Dependency -> Approval -> Evidence -> Audit`.

Hospitality must reuse existing Execution types, state machine, approvals, evidence, audit, and assistant projections instead of creating a second workflow engine.

Examples:

- guest service request;
- maintenance issue;
- room-readiness workflow;
- event setup;
- BEO change response;
- entitlement manual review;
- room-access issuance/revocation workflow.

## 8. Staff Connect and Guest Requests

Staff Connect is an operational coordination layer over requests and Execution, not a disconnected chat product.

### `hospitality_service_requests`

Required fields:

- `id`
- `org_id`
- `property_id`
- `department_id nullable`
- `room_id nullable`
- `guest_reference nullable`
- `request_type`
- `category`
- `source`
- `priority`
- `business_status`
- `summary`
- `details nullable`
- `requested_at`
- `assigned_at nullable`
- `accepted_at nullable`
- `started_at nullable`
- `completed_at nullable`
- `verified_at nullable`
- `sla_policy_id nullable`
- `execution_workflow_id`
- `created_by`
- timestamps

Request sources may include front desk, guest QR/web, mobile app, employee, phone transcription, Assistant, approved integration, event workflow, or automatic rule. Sources are activated by property configuration.

Canonical request state machine:

`new -> queued -> assigned -> accepted -> in_progress -> completed -> verified`

Lateral terminal/interruption states:

- `waiting`
- `blocked`
- `escalated`
- `cancelled`
- `failed`

Internal notes, guest-visible messages, and audit records are separate data projections.

## 9. Dispatch and SLA

Dispatch strategies:

- manual;
- round-robin;
- least-loaded;
- zone-based;
- skill-based;
- rule-based.

Dispatch may consider property/department membership, role, shift/availability, workload, required skill, priority, zone, and escalation eligibility. Cross-property assignment is denied unless explicitly authorized.

SLA inheritance:

`ATLAS default -> brand policy -> portfolio/management policy -> property policy -> request-category override`.

SLA calculations include:

- first response due;
- resolution due;
- warning threshold;
- breach status;
- escalation due.

No default minutes are invented for a real hotel. Unconfigured SLAs remain visibly unconfigured.

## 10. Guest Entitlements Engine

Breakfast validation is modeled as one entitlement category in a generic engine.

Supported entitlement concepts may include:

- breakfast;
- F&B credit;
- lounge access;
- parking;
- late checkout;
- early check-in;
- room upgrade;
- welcome amenity;
- resort credit;
- spa credit;
- transportation;
- Wi-Fi tier;
- property-defined benefits.

ATLAS never hard-codes a chain's loyalty/business rules into generic source code. Production decisions come from versioned, approved rule sets and authorized source systems.

Core entities:

- `hospitality_stay_contexts`
- `hospitality_entitlement_definitions`
- `hospitality_entitlement_rule_sets`
- `hospitality_entitlement_rules`
- `hospitality_entitlement_decisions`
- `hospitality_entitlement_redemptions`

Decision states:

- `eligible`
- `not_eligible`
- `manual_review`
- `source_unavailable`
- `expired`
- `invalid_context`
- `error`

Redemption and eligibility are separate. Rule-set version, decision timestamp, source reference, reason code, and audit evidence are preserved.

## 11. Events, Catering, and BEO Operations

The event domain converts an event source into verifiable multi-department execution.

Canonical flow:

`Lead/Event Source -> Hospitality Event -> Contract/Commercial Reference -> BEO Version -> Operational Plan -> Department Workflows -> Live Execution -> Changes/Incidents -> Closeout -> Financial Handoff -> Evidence/Audit`.

Core entities:

- `hospitality_events`
- `hospitality_event_orders`
- `hospitality_event_changes`
- `hospitality_event_timeline_items`
- `hospitality_event_vendor_requirements`

Event business states:

`inquiry -> tentative -> confirmed -> planning -> ready -> in_progress -> completed -> closed`

Alternative states:

- `cancelled`
- `postponed`
- `on_hold`

BEO records are versioned. Superseding versions never silently overwrite prior evidence. A material BEO change creates impact analysis and affected department work.

Events can orchestrate Banquets, Culinary, AV, Engineering, Housekeeping, Security, Front Office, Staffing, Vendor, Inventory, and Financial Handoff branches while retaining one parent event/workflow context.

## 12. Integration architecture

Browser clients never call hotel vendors with secret runtime configuration.

Pattern:

`Browser / ATLAS UI -> governed ATLAS API/Edge Function -> Hospitality adapter -> authorized provider`.

General integrations use capability-driven adapters for:

- PMS/CRS;
- access control;
- POS/F&B;
- loyalty;
- events/BEO;
- housekeeping;
- maintenance;
- messaging;
- identity;
- other approved provider families.

Existing Room Access `hospitality_provider_instances` remains access-provider-specific.

A separate `hospitality_integration_instances` domain records normalized metadata for non-access integrations with fail-closed states:

- `not_configured`
- `configured_unverified`
- `ready`
- `degraded`
- `offline`
- `disabled`

Presence of configuration never implies `ready`.

## 13. PMS, stay, and wallet-key boundary

The PMS or other explicitly approved stay source is authoritative for reservation/check-in/checkout/room assignment. Access vendors are authoritative for lock compatibility and credential lifecycle. Wallet/provider apps are authoritative for guest-device provisioning state where observable.

ATLAS stores normalized references and lifecycle state, never raw lock credential material.

Use the existing approved concepts from the prior Wallet Hotel Key and NFC/BLE Hybrid designs where compatible with current `main`:

- PMS provider instances;
- stay projections;
- room assignments;
- integration-event idempotency ledger;
- property automation policies;
- wallet provisioning sessions;
- transport metadata (`nfc|ble`);
- wallet/platform metadata (`apple_wallet|google_wallet|provider_app|none`);
- normalized readiness and lifecycle states.

No direct remote-unlock feature is introduced.

## 14. Hospitality Command Center

The Command Center is an evidence-backed projection, not a fabricated dashboard.

Navigation/drill-down hierarchy:

`U.S. -> business entity / management company -> brand -> portfolio -> region -> property -> department -> workflow -> record -> evidence`.

Property-level operational views include:

### Operations

- open requests;
- assigned;
- in progress;
- blocked;
- overdue;
- completed;
- verified.

### Service performance

- first-response time;
- resolution time;
- SLA compliance;
- escalation rate;
- reassignment rate;
- backlog aging;
- repeat-issue rate.

### Entitlements

- validations;
- eligible/not eligible/manual review;
- redemptions;
- unused entitlements;
- override rate;
- source failures;
- reversals;
- remaining balances where authoritative values exist.

### Events

- active events;
- expected attendance when known;
- tasks due;
- blocked tasks;
- incidents;
- late BEO changes;
- closeout status;
- financial handoff status.

### Access

- provider readiness;
- verified room mappings;
- credential lifecycle counts;
- provisioning states;
- revocation pending/failed;
- audit exceptions.

### System

- integration states;
- failed actions;
- security events;
- configuration blockers.

Every KPI must drill down to records/evidence where policy permits.

## 15. KPI definitions and baseline

The baseline is frozen before pilot scoring and is never moved retroactively to improve results.

Canonical KPI formulas include:

- `first_response_time = accepted_at - created_at`
- `resolution_time = completed_at - created_at`
- `assignment_delay = assigned_at - created_at`
- `sla_compliance = completed_within_sla / eligible_completed_requests`
- `escalation_rate = escalated_requests / eligible_requests`
- `reassignment_rate = reassigned_requests / eligible_requests`
- `open_backlog = unresolved_requests`
- `backlog_aging = unresolved requests by configured age bucket`
- `repeat_issue_rate = recurring categorized issues / eligible issues`
- `entitlement_exception_rate = manual_review_or_error / validation_attempts`
- `event_task_completion = completed event tasks / eligible event tasks`
- `event_change_rate = material BEO changes / eligible events`
- `access_issue_success_rate = provider-confirmed issued credentials / eligible issuance attempts`
- `access_revocation_success_rate = provider-confirmed revocations / eligible revocation attempts`

Metrics remain unavailable rather than fabricated when source data is missing.

## 16. Evidence model

Evidence is immutable or append-only according to existing ATLAS audit architecture.

Evidence can include:

- timestamps;
- normalized provider references;
- authorized user confirmation;
- supervisor verification;
- approved photo/file evidence;
- sanitized integration result;
- BEO version;
- approval reference;
- guest acknowledgment when explicitly supported;
- financial handoff reference;
- provider credential lifecycle result.

Evidence must never include raw reusable room-key material, provider secrets, private keys, master/facility codes, raw NFC/RFID dumps, BLE unlock frames, or decrypted provisioning secrets.

## 17. 60-day pilot model

A property pilot is a controlled evaluation of configured workflows. A property may be Crowne Plaza Orlando or another authorized U.S. hotel.

Suggested phases:

- Days 1–7: discovery and current-state map;
- Days 8–14: property configuration, memberships, RBAC, integrations boundaries;
- Days 15–21: workflow validation and training;
- Days 22–30: controlled launch;
- Days 31–45: operational measurement;
- Days 46–55: controlled optimization;
- Days 56–60: executive evaluation and rollout recommendation.

Pilot gates:

1. Security Gate
2. Operational Gate
3. Production Pilot Gate
4. Access Provider Gate when digital key is included

A failed gate moves the pilot/workflow to an explicit blocked state with required action.

## 18. Pilot scoring and executive review

Pilot outcome classifications:

- `successful_expand`
- `successful_with_modifications`
- `extend_controlled_pilot`
- `integration_blocked`
- `insufficient_evidence`
- `close_pilot`

Executive review compares:

`baseline -> pilot result -> difference -> operational significance -> evidence quality -> risks/blockers -> recommendation`.

No overall success score is reported without minimum evidence completeness defined by the pilot configuration.

## 19. U.S. portfolio expansion

A successful property pilot scales by configuration and integrations, not cloning code.

Rollout levels:

`Property -> Portfolio -> Management Company -> Brand/Chain -> Multi-brand Enterprise`.

Brand and corporate policies can provide defaults. Portfolio/property levels may override only fields marked as overridable. Protected corporate security/compliance controls cannot be bypassed by local configuration.

Cross-customer data remains isolated. Any future benchmarking across unrelated customers requires explicit aggregation/anonymization policy and authorization.

## 20. Room Access controlled-validation objective

The final Room Access goal for a specific authorized property is:

`provider ready -> property mapping verified -> room mapping verified -> legitimate stay/assignment -> authorized issue -> guest/staff device provisioning -> physical controlled access -> provider-backed status -> room-change/replacement test -> checkout/revocation test -> complete audit evidence`.

This is a validation of an official provider pathway. ATLAS does not bypass locks, clone keys, replay credentials, reverse engineer protocols, or manufacture access material.

## 21. Access-provider readiness gates

For every provider/property/transport combination, production readiness requires all applicable gates:

1. Authorized property relationship exists.
2. Provider contract/interface is official and supported for that property.
3. Server-side provider configuration exists in the approved secret/runtime boundary.
4. Non-destructive readiness probe succeeds.
5. Exact property mapping is verified.
6. Exact room mapping is verified.
7. Provider capability includes the requested issuance path.
8. PMS/stay source is ready when guest/stay eligibility is required.
9. Stay is legitimate and checked in, or an authorized staff-test policy explicitly permits a non-guest test room.
10. Credential validity window is bounded and valid.
11. User/service actor has required permissions and policy provenance.
12. No equivalent active credential exists unless replacement is explicitly requested.
13. Audit/evidence write path is available.
14. Emergency/kill switch is not active.

If any gate fails, issuance is blocked and a normalized blocker is recorded.

## 22. Controlled hotel-key test protocol

The test must use a room/lock explicitly designated by the hotel/property for validation.

### Phase A — Non-destructive readiness

- verify authenticated ATLAS user/service context;
- verify organization and property scope;
- verify provider instance and state;
- run supported provider readiness probe;
- verify exact property identifier;
- verify room mapping;
- confirm no secret appears in browser responses or logs.

Expected result: provider may advance to `ready` only when the official contract and configured capability are verifiably operational.

### Phase B — Credential issuance

- establish legitimate stay/assignment or approved staff-test assignment;
- confirm validity window and policy;
- call governed ATLAS issuance operation;
- provider must return success and an opaque credential/reference identifier;
- persist normalized lifecycle reference;
- record audit and evidence.

Expected result: `issued`/`provisioning_ready` only after provider confirmation. No optimistic success.

### Phase C — Device provisioning

Where supported:

- complete Apple Wallet, Google Wallet, or provider-app flow through the provider's official mechanism;
- record normalized provisioning state;
- do not claim silent installation when user consent is required.

Expected result: `active` only when activation/provisioning is confirmed according to the official provider pathway.

### Phase D — Physical controlled access

- tester approaches the explicitly designated test lock;
- uses the official Wallet/provider-app credential;
- records physical success/failure as a controlled verification event;
- captures only approved evidence and no raw credential material.

Expected result: successful access to the authorized test lock plus correlated provider/ATLAS evidence.

### Phase E — Replacement / room change

- assign an authorized second test room or approved mapping;
- issue/replace using provider-safe lifecycle;
- verify old credential lifecycle according to provider contract;
- verify new credential on the authorized second lock when applicable.

### Phase F — Checkout/revocation

- trigger approved checkout/test termination;
- request provider-backed revocation;
- confirm status as `revoked` only when provider confirms;
- verify the credential no longer grants access where the provider supports a controlled revocation test;
- preserve audit evidence.

## 23. Key-test pass/fail classification

### `implementation_verified`

Code, schema, contracts, security tests, and build pass on the exact feature SHA. This does not prove a hotel key works physically.

### `external_gates_pending`

ATLAS implementation is ready for provider validation, but official provider/property/PMS/wallet configuration or credentials are missing.

### `provider_validation_ready`

Official provider configuration, property mapping, and non-destructive readiness are verified; a controlled issuance test can proceed.

### `physical_key_test_passed`

A provider-backed credential was issued for the authorized test context and successfully operated the explicitly designated physical lock using the official mechanism, with correlated audit evidence.

### `production_ready_for_property`

Only after issuance, physical test, replacement/room-change behavior, revocation/checkout behavior, security review, and evidence review all pass for that exact `organization + property + provider + transport/platform` combination.

No mock, unit test, build, lock photograph, configuration presence, or provider brand name can set either `physical_key_test_passed` or `production_ready_for_property`.

## 24. Security boundaries for key validation

ATLAS may store:

- organization/property/stay/room references;
- verified mapping identifiers;
- provider instance id;
- opaque provider credential reference;
- transport/platform metadata;
- normalized state/status/error code;
- validity timestamps;
- policy/approval reference;
- audit/evidence metadata.

ATLAS must not store or expose:

- raw NFC/RFID contents;
- credential-emulation payloads;
- BLE unlock frames;
- master/facility keys;
- encoder secrets;
- private signing keys in business tables;
- vendor bearer tokens in browser state;
- decrypted provisioning tokens;
- reusable guest unlock secrets.

## 25. Migration strategy

Migration is additive and staged.

### Gate 1 — Canonical property model

Create property/portfolio/business-relationship/member/department/room structures without destroying existing Room Access tables.

### Gate 2 — Backfill

Backfill `hospitality_properties` from distinct existing `(org_id, property_id)` values, using existing `property_id` as `property_key`. Do not invent hotel names.

### Gate 3 — Referential reconciliation

Add controlled references/validation so existing Room Access rows resolve to canonical property identity.

### Gate 4 — Property memberships

Configure and validate property memberships before tightening RLS.

### Gate 5 — RLS tightening

Enable property-scoped policies after authorization tests prove legitimate users remain functional and cross-property access is denied.

### Gate 6 — Operational domains

Add requests/SLA, entitlements, and events as independent testable slices.

### Gate 7 — Analytics/evidence projections

Add Command Center read models only from real persisted records.

### Gate 8 — Key-validation extensions

Recover only compatible Wallet/PMS/NFC/BLE components from historical branches onto current `main`; do not merge stale branches wholesale.

## 26. Error handling

All security-sensitive and integration actions fail closed.

Representative normalized blockers:

- `organization_required`
- `property_scope_required`
- `permission_required`
- `property_membership_required`
- `integration_not_configured`
- `integration_not_verified`
- `source_unavailable`
- `room_mapping_missing`
- `room_mapping_unverified`
- `stay_not_checked_in`
- `provider_not_ready`
- `transport_not_supported`
- `wallet_platform_not_supported`
- `active_credential_exists`
- `replacement_not_confirmed`
- `revocation_pending`
- `provider_status_unavailable`

Browser-visible errors never disclose provider secrets, stack traces, lock-security internals, raw vendor bodies, or cryptographic material.

## 27. Testing strategy

Each implementation slice follows TDD.

Required verification layers:

- unit tests for domain/state/policy functions;
- schema contract tests;
- RLS/security contract tests;
- Edge/API contract tests;
- route/component integration tests;
- cross-property isolation tests;
- forbidden-secret regression tests;
- build/typecheck;
- deterministic provider mocks for implementation verification;
- provider sandbox where officially available;
- controlled authorized physical property validation for final key proof.

Repository gate:

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Focused Hospitality tests run before the full gate.

## 28. Accessibility and responsive operation

Hospitality operational surfaces must support desktop, tablet, and mobile, keyboard navigation, screen readers, scalable text, reduced motion, and high-contrast behavior where supported by ATLAS design tokens.

Guest-facing key/entitlement flows must provide equivalent status through text and accessible controls; critical access information cannot rely solely on color or animation.

## 29. Definition of done

This program is not complete merely because the designs are documented.

The implementation program is complete only when:

1. canonical Hospitality Core is reconciled to current `main`;
2. property-scoped RBAC/RLS is proven;
3. Staff Connect/Guest Request flow is functional;
4. Entitlements engine is functional;
5. Events/BEO workflow is functional;
6. Command Center reads real persisted evidence;
7. pilot baseline/evaluation model is implemented;
8. existing Room Access remains regression-safe;
9. key-validation extensions are recovered selectively from stale branches;
10. repository verification passes on the exact feature SHA;
11. external provider readiness is explicitly classified;
12. a controlled physical key test is performed only when official provider/property prerequisites exist;
13. `production_ready_for_property` is never claimed without the complete provider/property validation evidence.
