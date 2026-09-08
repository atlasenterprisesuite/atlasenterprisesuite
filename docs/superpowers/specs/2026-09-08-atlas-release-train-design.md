# ATLAS Release Train + Release Queue — Design

**Status:** Approved design, pending implementation plan
**Repository:** `atlasenterprisesuite/atlasenterprisesuite`
**Integration branch:** `release/atlas-a-z`
**Production branch:** `main`

## Objective

Allow every approved ATLAS module family to continue development and integration in parallel without forcing one incomplete or externally blocked module to stop the rest of the suite. Publication remains locked until modules satisfy explicit release gates. Production promotion occurs as a controlled sequence of waves with verification between waves.

## Core Principle

Development concurrency and production promotion are separate concerns.

- Modules may advance independently through design, implementation, integration and test preparation.
- A blocked module does not block unrelated development.
- A module cannot become `VERIFIED` without executable evidence.
- A module cannot enter production merely because implementation is complete.
- Production promotion is sequential, dependency-aware and rollback-capable.

## Module Lifecycle

Every releasable module uses the same lifecycle:

`DEVELOPING → INTEGRATED → TEST_PENDING → VERIFIED → RELEASE_READY → QUEUED → ACTIVATING → LIVE → PROD_VERIFIED`

Exceptional states:

- `BLOCKED`: technical or dependency blocker prevents forward progress in that module.
- `PROVIDER_REQUIRED`: internal implementation is ready but a real external provider/device/credential is absent.
- `ROLLBACK`: production activation failed and the module/wave is being restored to the previous verified state.

`BLOCKED` and `PROVIDER_REQUIRED` never stop independent modules from advancing.

## Global Release Lock

ATLAS maintains a global release lock for A-Z work.

While locked:
- `release/atlas-a-z` can continue receiving integrated module work;
- modules may become `RELEASE_READY` and enter the queue;
- no A-Z module is promoted to production;
- `main` remains the production-stable branch.

The lock may open only when the release controller has sufficient executable evidence for the wave being promoted and all mandatory upstream dependencies are verified.

## Release Queue Record

Each module or releasable surface must have a canonical queue record with at least:

- `module_id`
- `module_family`
- `owner`
- `status`
- `dependencies`
- `ci_status`
- `migration_status`
- `provider_status`
- `security_status`
- `release_ready`
- `queue_position`
- `release_wave`
- `candidate_sha`
- `production_sha`
- `production_verified`
- `blocker_reason`
- `updated_at`

A percentage alone can never promote a module.

## Recommended Release Waves

### Wave 0 — Foundation
Core, Identity, RBAC, Audit, Security, Settings, ATLAS Manager, Observability.

### Wave 1 — Finance
Finance, Accounting, GL, AP, AR, Bank/Cash, Reconciliation and financial reporting foundations.

### Wave 2 — People
HR, Time & Attendance, Payroll, Recruiting, Assessments, Compensation, Benefits/Deductions and Self-Service.

### Wave 3 — Revenue & Operations
CRM, Sales, Customers, Vendors, Purchasing, Inventory, POS, Projects and operational Analytics.

### Wave 4 — Platform Services
Drive, Knowledge Atlas, Voice, Connect, Communications, Creator Studio and Sites.

### Wave 5 — Health
ATLAS Health surfaces that have passed their additional evidence, privacy, governance and clinical-safety gates.

### Wave 6 — Mobility & Physical Operations
Ride OS, GPS 4D, Telecom/MiFi, Parks, AutoWash and Insurance surfaces.

### Wave 7 — Financial Rails & Specialized Surfaces
ATLAS Pay, real payment adapters and other regulated/provider-dependent specialized modules.

### Wave 8 — Full Suite Closure
A-Z registry verification, final cross-module smoke matrix, production evidence and final suite acceptance.

## Promotion Algorithm

For each queued wave:

1. Freeze the candidate SHA for that wave.
2. Confirm required upstream modules are `PROD_VERIFIED` or part of the same approved wave.
3. Confirm typecheck, unit, integration, security and build gates actually executed and passed.
4. Confirm required migrations and provider readiness states.
5. Promote the wave.
6. Run production smoke tests for routes, auth, permissions, data and critical actions.
7. If successful, mark the wave/modules `PROD_VERIFIED` and continue to the next wave.
8. If unsuccessful, stop promotion, rollback/disable the affected wave, preserve the last verified production state, diagnose and correct before continuing.

A failed wave does not automatically undo already verified prior waves.

## CI and Current Runner Blocker

The current GitHub Actions pre-runner failure (`runner_id: 0`, `steps: []`) prevents modules from moving from `TEST_PENDING` to `VERIFIED` because no executable test evidence exists.

It does **not** prevent modules from progressing through `DEVELOPING` and `INTEGRATED`, nor from preparing migrations, tests, routes, adapters or readiness contracts.

Once runners execute real steps, actual software failures are handled normally and independently from the infrastructure incident.

## Truth-State Rules

Never represent a capability as connected, live, paid, filed, clinical-production-ready, device-controlled or provider-backed without evidence.

Provider-dependent modules may be `RELEASE_READY` for their internal surface while retaining `PROVIDER_REQUIRED` capabilities. The UI must expose truthful readiness states rather than simulate success.

## Higher-Risk Gates

The following require stronger promotion gates than ordinary enterprise UI:

- Health/clinical workflows: evidence, privacy, governance and safety verification.
- Real money movement/payment rails: provider authorization, transaction controls, reconciliation and rollback/recovery evidence.
- Mobility/device commands: adapter capability verification, permission gates and operational fail-safe behavior.
- Sensitive identity/security changes: least privilege, auditability and recovery paths.

## Parallel Development Policy

A wave no longer needs to be green before development on another wave begins.

Instead:

> A wave must be green before it is promoted to production, not before another independent wave may be developed.

Teams/agents should continue independent work whenever dependencies permit, while recording exact blockers and readiness states in the release queue.

## Definition of Release Ready

`RELEASE_READY` means:
- implementation exists;
- routes/actions are real and permission-gated;
- no fake runtime/provider state;
- migrations/configuration are versioned;
- required tests exist;
- mandatory external dependencies are either verified or explicitly classified `PROVIDER_REQUIRED`;
- no unresolved design or security blocker remains.

It does **not** mean tested, deployed or production verified.

## Definition of Production Verified

`PROD_VERIFIED` requires evidence from the actual promoted production SHA, including:
- successful deployment;
- healthy domain/routes/assets/APIs;
- authentication and authorization behavior;
- data isolation/persistence checks where applicable;
- critical action smoke tests;
- no unexpected 404/500 or provider-state fabrication;
- recorded production SHA and verification evidence.

## Relationship to Existing A-Z Program

This design supersedes the old sequencing rule that required each wave to finish before the next wave could be accepted for development. The A-Z program remains the canonical integration program, but wave ordering now governs **release promotion**, not development concurrency.

`release/atlas-a-z` remains the integration axis. `main` remains production-stable until the controlled release train promotes verified waves according to this design.
