# ATLAS 777 — Canonical Launch Inventory (initial evidence ledger)

Snapshot: 2026-11-04. Source: GitHub issue search, repository commit search, scheduled-task inventory. This is an **initial sampled inventory**, NOT a verified census of every module or conversation.

Main HEAD observed: `e84d93d8e6d3a2f17da3fbbbe8c5d6ea8ee30b12`. Recheck before all changes. All rows remain **P0 NO-GO** for launch unless independent exact-SHA evidence exists.

| Slug | Area | Canonical reference | Logical owner | Evidence / state | Next step |
|---|---|---|---|---|---|
| core-security | Platform & Security | [#857](https://github.com/atlasenterprisesuite/atlasenterprisesuite/issues/857) | Security | Issue discovered; production not verified | Audit RBAC/RLS and data protection gates |
| offline-ai | Platform & Security | [#987](https://github.com/atlasenterprisesuite/atlasenterprisesuite/issues/987) | Platform | Issue discovered | Validate isolated offline sync and revocation |
| academy-credentials | Products & Modules | [#990](https://github.com/atlasenterprisesuite/atlasenterprisesuite/issues/990), [PR #992](https://github.com/atlasenterprisesuite/atlasenterprisesuite/pull/992) | Academy Agent | Draft; latest observed test commit `745fc2d1eddbd908feba970712ef29f89adae9e6`; CI not certified | Academy agent owns TDD and CI; orchestrator must not modify branch |
| atlas-tax | Products & Modules | [#989](https://github.com/atlasenterprisesuite/atlasenterprisesuite/issues/989) | Tax | Issue discovered; other similar IRS issues #982, #960, #959, #956 | Compare underlying IRS sources and dates before deduplication |
| learning-labs | Products & Modules | [#846](https://github.com/atlasenterprisesuite/atlasenterprisesuite/issues/846) | Learning | Issue discovered | Map to Academy without conflating credentials |
| pay-pricing | Business & Commercialization | [#885](https://github.com/atlasenterprisesuite/atlasenterprisesuite/issues/885) | Finance/Pay | Issue discovered | Verify cost engine, consent and payment safeguards |
| first-customer | Business & Commercialization | [#842](https://github.com/atlasenterprisesuite/atlasenterprisesuite/issues/842) | Business | Issue discovered | Review pilot criteria; no real charges |
| chat-archive | Documentation & Evidence | [#871](https://github.com/atlasenterprisesuite/atlasenterprisesuite/issues/871) | Master Orchestrator | Issue discovered; no universal chat access | Inventory only accessible conversations with stable identifiers |
| global-ledger | Development & Tests | [#841](https://github.com/atlasenterprisesuite/atlasenterprisesuite/issues/841) | Master Orchestrator | Issue discovered | Reuse ledger rather than create competing source of truth |
| launch-organization | Documentation & Evidence | [#993](https://github.com/atlasenterprisesuite/atlasenterprisesuite/issues/993) | Master Orchestrator | Open coordination issue | Expand verified inventory and readiness matrix |

## Unclassified inbox
- Issues not yet individually audited: #953 Music Studio, #952 Film Studio, #951 Genesis, #950 Visual Fidelity, #945 Mind & Growth, #936 iPhone Control, #935 One Core, #918 BI, #911 CatchUp, #908 Video Audit, #897 Humanity, #896 NeuroSync, #888 Orbital City, #886 Banking, #881 Genesis Renewal, #872 Spatial Capture, #869 Indoor Delivery, #866 Autonomous Executor, #859 Truth Intelligence, #858 Surface Intelligence, #856 Device Program, #853 Photo Vault, #849 Health Sentinel, #844 Rainbow, #843 Business Administration, #839 Manufacturing.
- These are pointers, not implementation or readiness claims.

## Potential duplicate ledger (not deletion authorization)
- Multiple ATLAS Tax IRS change issues (#989, #982, #960, #959, #956, #944, #934, #899, #894, #892, #884, #865): compare regulation identifiers, dates, links and impacts before proposing consolidation.
- Genesis #951, One Core #935, Genesis Renewal #881 and autonomous execution #866: possible overlapping orchestration concepts; preserve distinct scopes until source review.
- Chat archive #871 and global ledger #841: cross-reference to #993; do not replace either without compatibility review.

## Launch gates (P0 by default)
Security RBAC/RLS and cross-tenant revocation; data privacy; CI exact-SHA; E2E and accessibility; deployment integrity; disaster recovery; documentation; customer support; commercial and payment controls. Missing evidence = NO-GO, not failure or success.

## Operating boundaries
No merge, deploy, production writes, financial transactions, secrets, mass deletion or unauthorized chat access. The Master Orchestrator owns this inventory; Academy Agent owns #990/#992; RUN 2.0 P0 owns prioritized remediation. Preserve originals and evidence provenance.


## F1 reconciliation — existing authorities (2026-11-04)

Source inspection: [Global Execution Ledger #841](https://github.com/atlasenterprisesuite/atlasenterprisesuite/issues/841), [Chat Archive #871](https://github.com/atlasenterprisesuite/atlasenterprisesuite/issues/871), and [Master Evidence Registry contract](../governance/ATLAS_MASTER_EVIDENCE_REGISTRY.md) on main. These are verified *documented contracts*, not evidence of live runtime behavior.

| Concern | Canonical authority | This inventory's role | Gate |
| --- | --- | --- | --- |
| Execution events, job provenance, errors and correlation | #841; existing execution_workflows/tasks/steps and Evidence Engine | Link module to existing execution record; do not create another execution event store | P0: tenant isolation, append-only, exact-SHA |
| Historical chat sources, attachments and restoration hashes | #871 | Link only source IDs, classification and provenance; no raw personal chat contents | P0: consent, confidentiality and restoration verification |
| Release evidence, supersession and production claims | `docs/governance/ATLAS_MASTER_EVIDENCE_REGISTRY.md`; `public.atlas_master_evidence_registry` contract | Reference authoritative claim and source; never certify production from this Markdown | P0: deployed SHA, environment, RLS and machine evidence |
| Launch navigation and product ownership | #993 and this PR #994 inventory | Non-authoritative coordination index and gap list | P0: full census and reconciled ownership |

### Source-backed scope decisions
- **#841 and #871 are not duplicates.** They have distinct execution-event versus historical-source purposes. Cross-link them under #993; do not close or merge.
- **#993 does not replace the Master Evidence Registry.** It only tracks ownership and missing gates; operational authority remains with existing Release Control.
- **#990 / PR #992 remains Academy Agent-owned.** This branch must not modify Academy implementation or CI.
- **Tax IRS alerts remain candidates, not proven duplicates.** Match official source, form, effective date, revision and content digest before consolidating.

### Launch-readiness evidence matrix (sample; unverified = NO-GO)
| Surface | Security/RLS | Exact-SHA CI | E2E/accessibility | Production integrity | Commercial controls | Launch decision |
| --- | --- | --- | --- | --- | --- | --- |
| Academy #990 / PR #992 | Missing authorization/tenant negative evidence | Not established | Not established | Not established | Checkout sandbox only | P0 NO-GO |
| Offline AI #987 | LAN pairing/revocation not verified | Not established | Device tests pending | Not established | N/A | P0 NO-GO |
| Tax #989 | Versioned rules approval pending | Not established | Regression tests pending | Not established | N/A | P0 NO-GO |
| Launch organization #993 / PR #994 | No production writes authorized | CI not established | Not applicable to documentation | No production change | N/A | Documentation-only |

### Chat ingestion boundary
Only references actually accessible through authorized tools may be indexed. Record source ID, date, classification, consent basis and content hash if obtained. Do not put raw chat transcripts, credentials, financial/health/legal personal details or unapproved files in public GitHub. Missing sources remain `PENDING_ACCESS`; never mark `ARCHIVED` or `READY_TO_CLEAN` without verified restoration.

### Next verified action
Inspect registry module routes and compare current main HEAD with PR #994 base; add evidence-backed route mapping in a later isolated change. No merge/deploy/delete.


## F2 — 40 registered modules, source-mapped (2026-11-04)

Source: [apps/web/src/modules/registry.ts](../../apps/web/src/modules/registry.ts), blob SHA `f0ae19bc7d92b49ded0d24e4a4935dd8eef57366` from main at inspection. Parsed **40** distinct module IDs. This is a **source declaration inventory**, not a census of all services, nor proof of route rendering, authorization, provider readiness, CI or deployment. The registry's `implemented` status explicitly does not certify production. Owner labels marked unconfirmed are classification placeholders, not assigned people.

| Slug | Classification | Registry domain | Declared route | Logical owner | Declared state | Cross-reference | Gate | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `certificate-lifecycle` | Plataforma y Seguridad | Platform | `/security/certificates` | Platform owner (unconfirmed) | `external-gated` (registry declaration only) | not reconciled | P0 NO-GO | Validate route, owner, dependency and runtime exact-SHA |
| `cloud` | Plataforma y Seguridad | Platform | `/cloud` | Platform owner (unconfirmed) | `implemented` (registry declaration only) | not reconciled | P0 NO-GO | Validate route, owner, dependency and runtime exact-SHA |
| `work` | Plataforma y Seguridad | Platform | `/work` | Platform owner (unconfirmed) | `implemented` (registry declaration only) | not reconciled | P0 NO-GO | Validate route, owner, dependency and runtime exact-SHA |
| `automations` | Plataforma y Seguridad | Platform | `/automations` | Platform owner (unconfirmed) | `implemented` (registry declaration only) | not reconciled | P0 NO-GO | Validate route, owner, dependency and runtime exact-SHA |
| `assistant` | Plataforma y Seguridad | Intelligence | `/assistant` | Intelligence owner (unconfirmed) | `implemented` (registry declaration only) | not reconciled | P0 NO-GO | Validate route, owner, dependency and runtime exact-SHA |
| `knowledge` | Plataforma y Seguridad | Intelligence | `/knowledge` | Intelligence owner (unconfirmed) | `implemented` (registry declaration only) | not reconciled | P0 NO-GO | Validate route, owner, dependency and runtime exact-SHA |
| `bible-os` | Plataforma y Seguridad | Intelligence | `/knowledge/bible` | Intelligence owner (unconfirmed) | `implemented` (registry declaration only) | not reconciled | P0 NO-GO | Validate route, owner, dependency and runtime exact-SHA |
| `business` | Productos y Módulos | Business | `/business` | Business owner (unconfirmed) | `implemented` (registry declaration only) | not reconciled | P0 NO-GO | Validate route, owner, dependency and runtime exact-SHA |
| `revenue` | Productos y Módulos | Business | `/revenue` | Business owner (unconfirmed) | `implemented` (registry declaration only) | not reconciled | P0 NO-GO | Validate route, owner, dependency and runtime exact-SHA |
| `advisory` | Productos y Módulos | Business | `/advisory` | Business owner (unconfirmed) | `implemented` (registry declaration only) | not reconciled | P0 NO-GO | Validate route, owner, dependency and runtime exact-SHA |
| `finance` | Productos y Módulos | Finance | `/finance` | Finance owner (unconfirmed) | `implemented` (registry declaration only) | not reconciled | P0 NO-GO | Validate route, owner, dependency and runtime exact-SHA |
| `accounting` | Productos y Módulos | Finance | `/finance/accounting` | Finance owner (unconfirmed) | `implemented` (registry declaration only) | not reconciled | P0 NO-GO | Validate route, owner, dependency and runtime exact-SHA |
| `pay` | Productos y Módulos | Finance | `/finance/pay` | Finance / Pay (#885) | `external-gated` (registry declaration only) | #885 | P0 NO-GO | Validate route, owner, dependency and runtime exact-SHA |
| `tax` | Productos y Módulos | Finance | `/tax` | Tax (#989) | `implemented` (registry declaration only) | #989 | P0 NO-GO | Validate route, owner, dependency and runtime exact-SHA |
| `crm` | Productos y Módulos | Business | `/crm` | Business owner (unconfirmed) | `external-gated` (registry declaration only) | not reconciled | P0 NO-GO | Validate route, owner, dependency and runtime exact-SHA |
| `commerce` | Productos y Módulos | Business | `/commerce` | Business owner (unconfirmed) | `external-gated` (registry declaration only) | not reconciled | P0 NO-GO | Validate route, owner, dependency and runtime exact-SHA |
| `inventory` | Productos y Módulos | Operations | `/inventory/procure-to-pay` | Operations owner (unconfirmed) | `implemented` (registry declaration only) | not reconciled | P0 NO-GO | Validate route, owner, dependency and runtime exact-SHA |
| `analytics` | Productos y Módulos | Business | `/analytics` | Business owner (unconfirmed) | `implemented` (registry declaration only) | not reconciled | P0 NO-GO | Validate route, owner, dependency and runtime exact-SHA |
| `connect` | Productos y Módulos | Communications | `/connect` | Communications owner (unconfirmed) | `external-gated` (registry declaration only) | not reconciled | P0 NO-GO | Validate route, owner, dependency and runtime exact-SHA |
| `telecom` | Productos y Módulos | Communications | `/telecom` | Communications owner (unconfirmed) | `external-gated` (registry declaration only) | not reconciled | P0 NO-GO | Validate route, owner, dependency and runtime exact-SHA |
| `people` | Productos y Módulos | People | `/people` | People owner (unconfirmed) | `implemented` (registry declaration only) | not reconciled | P0 NO-GO | Validate route, owner, dependency and runtime exact-SHA |
| `payroll` | Productos y Módulos | People | `/payroll` | People owner (unconfirmed) | `external-gated` (registry declaration only) | not reconciled | P0 NO-GO | Validate route, owner, dependency and runtime exact-SHA |
| `learning` | Productos y Módulos | People | `/learning` | Learning / Academy (#990) | `implemented` (registry declaration only) | #990 / PR #992 (Academy extension) | P0 NO-GO | Validate route, owner, dependency and runtime exact-SHA |
| `health` | Productos y Módulos | Health | `/health` | Health owner (unconfirmed) | `implemented` (registry declaration only) | not reconciled | P0 NO-GO | Validate route, owner, dependency and runtime exact-SHA |
| `care` | Productos y Módulos | Health | `/care` | Care | `external-gated` (registry declaration only) | not reconciled | P0 NO-GO | Validate route, owner, dependency and runtime exact-SHA |
| `insurance` | Productos y Módulos | Protection | `/insurance` | Protection owner (unconfirmed) | `external-gated` (registry declaration only) | not reconciled | P0 NO-GO | Validate route, owner, dependency and runtime exact-SHA |
| `studio` | Productos y Módulos | Creative | `/studio` | Studio | `external-gated` (registry declaration only) | PR #939 | P0 NO-GO | Validate route, owner, dependency and runtime exact-SHA |
| `site-review` | Productos y Módulos | Creative | `/site-review` | Creative owner (unconfirmed) | `implemented` (registry declaration only) | not reconciled | P0 NO-GO | Validate route, owner, dependency and runtime exact-SHA |
| `voice` | Productos y Módulos | Creative | `/voice` | Creative owner (unconfirmed) | `external-gated` (registry declaration only) | not reconciled | P0 NO-GO | Validate route, owner, dependency and runtime exact-SHA |
| `events` | Productos y Módulos | Entertainment | `/events` | Entertainment owner (unconfirmed) | `implemented` (registry declaration only) | not reconciled | P0 NO-GO | Validate route, owner, dependency and runtime exact-SHA |
| `frontier` | Productos y Módulos | Entertainment | `/frontier` | Entertainment owner (unconfirmed) | `implemented` (registry declaration only) | not reconciled | P0 NO-GO | Validate route, owner, dependency and runtime exact-SHA |
| `hospitality` | Productos y Módulos | Hospitality | `/hospitality` | Hospitality / Academy (#990) | `external-gated` (registry declaration only) | #990 / PR #992 (Academy extension) | P0 NO-GO | Validate route, owner, dependency and runtime exact-SHA |
| `ride` | Productos y Módulos | Mobility | `/ride` | Ride OS | `implemented` (registry declaration only) | not reconciled | P0 NO-GO | Validate route, owner, dependency and runtime exact-SHA |
| `gps` | Productos y Módulos | Mobility | `/gps` | GPS | `implemented` (registry declaration only) | not reconciled | P0 NO-GO | Validate route, owner, dependency and runtime exact-SHA |
| `city` | Productos y Módulos | Spatial | `/city` | Spatial owner (unconfirmed) | `implemented` (registry declaration only) | not reconciled | P0 NO-GO | Validate route, owner, dependency and runtime exact-SHA |
| `aviation` | Productos y Módulos | Mobility | `/mobility/aviation` | Mobility owner (unconfirmed) | `implemented` (registry declaration only) | not reconciled | P0 NO-GO | Validate route, owner, dependency and runtime exact-SHA |
| `galaxy` | Plataforma y Seguridad | Platform | `/galaxy` | Platform owner (unconfirmed) | `implemented` (registry declaration only) | not reconciled | P0 NO-GO | Validate route, owner, dependency and runtime exact-SHA |
| `device-os` | Plataforma y Seguridad | Platform | `/device-os` | Platform owner (unconfirmed) | `external-gated` (registry declaration only) | not reconciled | P0 NO-GO | Validate route, owner, dependency and runtime exact-SHA |
| `release-control` | Plataforma y Seguridad | Platform | `/release` | Release Control | `implemented` (registry declaration only) | Master Evidence Registry | P0 NO-GO | Validate route, owner, dependency and runtime exact-SHA |
| `execution` | Plataforma y Seguridad | Platform | `/execution/manager/readiness` | Execution (#841) | `implemented` (registry declaration only) | #841 | P0 NO-GO | Validate route, owner, dependency and runtime exact-SHA |

**Other classification areas:** Development & Tests → [#841](https://github.com/atlasenterprisesuite/atlasenterprisesuite/issues/841) execution evidence and CI; Business & Commercialization → [#842](https://github.com/atlasenterprisesuite/atlasenterprisesuite/issues/842) pilot, [#885](https://github.com/atlasenterprisesuite/atlasenterprisesuite/issues/885) pricing; Documentation & Evidence → [#871](https://github.com/atlasenterprisesuite/atlasenterprisesuite/issues/871) chat archive, [#993](https://github.com/atlasenterprisesuite/atlasenterprisesuite/issues/993) organization and Master Evidence Registry. These are governance workstreams, not extra product module IDs.

**Reconciliation:** Previous ten-row sample includes non-registry workstreams (offline-ai, academy-credentials, chat-archive, global-ledger, launch-organization) and must not be added to the 40 as if they were product modules. Academy is a proposed extension of Learning/Hospitality, not yet a separately registered module. Potential duplicates remain proposals only.

**Missing P0 evidence for all 40:** route E2E, authentication/authorization, tenant isolation and revocation, accessibility, current CI exact-SHA, deployed-SHA runtime checks, privacy, support and provider-specific commercial readiness. No launch GO is implied.


## F3 — critical-route source reconciliation (2026-11-04)

Inspected main source at registry blob `f0ae19bc7d92b49ded0d24e4a4935dd8eef57366` and route references in `apps/web/src/App.tsx`, `apps/web/src/extensions/resolveAtlasExtension.tsx`, `scripts/verify-neural-integrity.mjs` and `data/ops/module-production-acceptance.json`. This is a **static-source check**, not an executed E2E or production observation.

| Module | Route | Static source finding | Identity boundary | Evidence gap / next gate |
| --- | --- | --- | --- | --- |
| `certificate-lifecycle` | `/security/certificates` | Explicit `App.tsx` Route renders `CertificateLifecyclePage`; acceptance JSON declares `VERIFICATION_HOLD` | `RequireAtlasIdentity` wrapper in route declaration | Validate tenant RLS, live TLS/mTLS, CI and deployed route exact-SHA |
| `execution` | `/execution/manager/readiness` | Explicit `App.tsx` Route renders `ManagerReadinessLauncher`; prior regression documented in `docs/audit/2026-09-13-manager-readiness-route-verification.md` | `RequireAtlasIdentity` wrapper in route declaration | Run current regression, RBAC/revocation and E2E at exact SHA |
| `release-control` | `/release` | Resolved by `resolveAtlasExtension.tsx` to `ReleaseControlIntegrationHub`; do not assume absence merely because not an explicit `App.tsx` Route | `RequireAtlasIdentity` wrapper in extension resolver | Verify resolver integration, route E2E, evidence registry and deployed SHA |

### Reconciliation rules for remaining 37 routes
1. Match registry `route` against **both** explicit React routes and extension resolver paths, not only a string search of `App.tsx`.
2. Distinguish an identity wrapper in source from effective server-side authorization and RLS. Neither follows automatically from the other.
3. Distinguish a route declaration from a passing browser E2E or live production route.
4. Preserve `VERIFICATION_HOLD` where acceptance evidence says so; do not promote based on `implemented`.
5. Record source blob/commit, path, security boundary, test run and deployed SHA independently before changing launch verdict.

**Current decision:** 3/40 module routes have additional static-source references inspected; 37/40 still need this level of reconciliation. All 40 remain P0 NO-GO for release certification. This document is a coordination index, not the Release Control authority.
