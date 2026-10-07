# ATLAS Rebirth Sweep — Canonical Portfolio and Recovery Ledger

Date: 2026-10-07  
Branch: `feat/atlas-rebirth-sweep`  
Baseline: `4151f226015aab05ceb9330483e1538f11117138`

## Purpose

This sweep treats ATLAS as one evolving organism rather than a collection of unrelated apps.

The rule is:

1. preserve verified capability;
2. keep one canonical owner for each product/domain;
3. merge overlapping surfaces into that owner;
4. retain compatibility routes where removing them would break existing workflows;
5. remove dead duplicate UI and duplicate navigation;
6. keep unimplemented historical concepts visible as **hold**, not as fake production modules;
7. preserve RBAC, RLS, audit, provider truth and fail-closed production evidence.

This ledger is an architecture/portfolio decision. It does **not** upgrade a module's readiness or provider state.

## Canonical module sweep

The canonical registry contains 39 module identities. Every registry module has exactly one rebirth decision.

### KEEP — distinct canonical owners

| Module | Decision |
| --- | --- |
| `cloud` | Keep as infrastructure, operations and production-evidence owner. |
| `work` | Keep as governed work/execution product owner. |
| `assistant` | Keep as conversational/multi-provider intelligence owner. |
| `knowledge` | Keep as knowledge, provenance and research owner. |
| `business` | Keep as business command/growth owner. |
| `advisory` | Keep as advisory/client/Business Launch 360 owner. |
| `finance` | Keep as financial system-of-record family owner. |
| `pay` | Keep as ATLAS Pay / Financial Network owner, provider-gated where required. |
| `tax` | Keep as tax preparation/compliance workspace owner. |
| `crm` | Keep as customer/revenue relationship system. |
| `commerce` | Keep as commerce/storefront/order domain owner. |
| `inventory` | Keep as inventory/procure-to-pay domain owner. |
| `connect` | Keep as communications/carrier/MVNO owner. |
| `people` | Keep and promote as People/HR family hub. |
| `payroll` | Keep as payroll calculation/control domain. |
| `learning` | Keep as learning/training domain. |
| `health` | Keep as Health OS/research owner. |
| `care` | Keep as care operations domain. |
| `insurance` | Keep and promote as regulated protection/verification hub. |
| `studio` | Keep as Creator/Studio owner. |
| `voice` | Keep as ATLAS Voice owner. |
| `events` | Keep as events/entertainment domain. |
| `frontier` | Keep as governed entertainment vertical. |
| `hospitality` | Keep as Hospitality OS owner. |
| `ride` | Keep as unified mobility marketplace/app owner. |
| `gps` | Keep as GPS 4D/navigation owner. |
| `city` | Keep as Digital City/Urban Twin owner. |
| `aviation` | Keep as aviation/mobility domain. |
| `galaxy` | Keep as spatial navigation/portal surface. |
| `device-os` | Keep as Device OS, Device DNA, recovery and hardware-control owner. |

### MERGE — preserve route, converge ownership

| Existing module | Canonical owner | Ruling |
| --- | --- | --- |
| `automations` | `work` | Governed automation is an execution capability of Work. |
| `bible-os` | `knowledge` | Bible OS is a specialized evidence/provenance research domain. |
| `revenue` | `business` | Revenue Operations becomes a Business command capability across CRM/Commerce/Finance. |
| `accounting` | `finance` | Accounting remains a deep Finance capability, not a competing top-level family. |
| `analytics` | `business` | Business Analytics becomes a shared insight capability surfaced by Business/domain owners. |
| `telecom` | `connect` | Telecom/carrier behavior is owned by Connect. |
| `site-review` | `studio` | Site Review becomes Studio/Web Launch review evidence. |
| `release-control` | `cloud` | Release Control is an internal Cloud Release & Operations capability. |
| `execution` | `work` | Universal Execution remains the engine beneath Work and governed automation. |

These compatibility routes remain available so convergence does not break existing links. Their duplicate top-level navigation is removed.

## Removed now

The following were removed because they were duplicate/dead presentation, not unique capability:

- duplicate legacy `EnterpriseHome`, `BusinessHome`, `FinanceHome`, `AccountingHome` and `HealthHome` implementations in `App.tsx`;
- duplicate exact App route ownership for surfaces already owned by `resolveAtlasExtension`;
- duplicate Cloud navigation entries for Releases and Production Verify in favor of one `/cloud/operations` entry;
- separate Cloud console cards for Production Verification, Deployment/Release Center, Manager Readiness and Release Control in favor of **Release & Operations**;
- provider branding as the primary narration identity; the product surface is now **ATLAS Voice Narrator**, while the current external engine remains disclosed inside the provider/privacy boundary;
- `ATLAS Work Soberano` as visible product naming; the product identity is **ATLAS Work**.

No verified business capability was deleted.

## Recovered historical capability

The following prior ATLAS ideas were checked against current source and assigned an owner instead of being forgotten:

| Capability | State | Canonical owner / action |
| --- | --- | --- |
| ATLAS MAX | merged | Assistant intelligence/entitlement layer. |
| ATLAS Mystic Oracle | private | Assistant private reflective capability; not enterprise truth. |
| Faith & Reflection | private | Knowledge/personal reflection boundary. |
| Image Lab | merged | Studio / `/studio/create?type=image`. |
| CleanScan 3D | merged | City / Urban Twin. |
| Device DNA / Genesis / Phoenix direction | merged | Device OS. |
| MVNO / ATLAS Carrier | merged | Connect, external provider actions fail-closed. |
| ATLAS Financial Network | merged | ATLAS Pay. |
| Ride client / driver / dealer / rental experiences | merged | One role-aware Ride product. |
| Spatial Interface / gesture capability | merged | Device OS, with Galaxy as spatial navigation surface where applicable. |
| Work Command Center | merged | Work. |
| Business Launch 360 | merged | Advisory. |
| ATLAS AI Universe | merged | Studio; conversational model routing remains Assistant/AI Gateway. |
| Creator Library | merged | Studio. |
| Remote Assist | merged | Device OS, native adapter gated. |
| Device Recovery & Security | merged | Device OS; recovery/malware/boot/storage/memory workflows remain capability-gated. |
| Jaque Mate + Sentinel | merged | Health research. |
| ATLAS Partner Network | merged | Business / `/business/network`; distinct from telecom/carrier connectivity. |
| ATLAS Drive | hold | Intended Work family; no canonical production route is registered yet. |
| ATLAS Cars | hold | Retained for Ride + Device OS convergence; no canonical production surface verified. |
| Parks Global | hold | Retained as historical concept; no canonical production module found. |
| AutoWash | hold | Retained as historical concept; no canonical production module found. |
| Latin Command Center | hold | Retained as regional product research until route, owner and data boundary are implemented. |

A **hold** is deliberate: it prevents a remembered idea from being lost while also preventing ATLAS from presenting it as live.

## New evolution controls

### Adaptive onboarding

`/settings/personalize` reuses `atlas_user_preferences.preferences` and adds:

- goals/interests;
- work mode;
- automation preference;
- preferred start surface;
- progressive discovery;
- pinned systems;
- recommendations generated only from canonical module IDs.

Personalization changes ordering/recommendations only. It never relaxes authentication, tenant scope, RBAC, provider readiness, regulated approvals or release gates.

### Release & Operations convergence

`/cloud/operations` is now the canonical Cloud entry point for:

- Deployment & Release Center;
- Production Verification;
- Manager Readiness;
- full Release Control;
- Runtime Integrity.

The underlying evidence surfaces remain separate and authoritative. The hub does not create a second release store.

### Static Architecture Auditor

`scripts/verify-atlas-architecture.mjs` is added to both `verify:all` and `verify:cloudflare`.

It fails when:

- canonical module IDs/routes are duplicated;
- exact route ownership is duplicated between `App` and the extension resolver;
- removed legacy module homes are reintroduced;
- Personalize ATLAS disappears;
- Suite stops consuming the canonical portfolio decision map;
- Cloud release entry points fragment again;
- provider-specific narration is restored as the primary ATLAS Voice identity;
- legacy Work product naming returns.

## Evidence boundaries

This sweep does not claim that every ATLAS module is feature-complete.

- Registry identity is source evidence.
- Unit/integration/typecheck/build evidence is software evidence.
- Provider connectivity requires provider evidence.
- Production completion requires Cloudflare/public-edge/global fail-closed evidence and exact-SHA verification.
- Hardware/native features require a real authorized adapter.
- Regulated Health, Insurance, Finance, Payroll, Carrier and similar actions retain their existing policy and authorization boundaries.

## Next evolution waves

After this portfolio convergence is production-verified, the next high-value layers are:

1. source-import/static dependency evidence into Dependency Ecology;
2. cross-module journey contracts and reconciliation;
3. data-owner/RLS/RBAC coverage per canonical family;
4. provider capability matrix and portable adapters;
5. whole-suite performance/accessibility/runtime evidence;
6. progressive retirement only when replacement lineage and migration evidence are proven.
