# ATLAS Evidence Engine

## Purpose

ATLAS Evidence Engine is the common verification contract for provider, infrastructure, deployment and business-state evidence. It extends the existing authenticated-evidence governance in `@atlas/core`; it does not create a parallel authority.

## Core states

- `pass`: the check was observed and satisfied.
- `fail`: an observed requirement failed.
- `unverified`: no valid observation exists for the required boundary.
- `warning`: evidence exists but does not satisfy a non-blocking expectation.

Engine outcomes:

- `PASS`: every blocking check passed.
- `BLOCKED`: at least one blocking check is unverified/warning but no blocking failure was observed.
- `FAIL`: at least one blocking check failed.

A P0 check is blocking by default. A P1 check becomes blocking only when `required: true`.

## Fail-closed contract

In `fail-closed` mode:

1. P0 `fail` => `FAIL`.
2. P0 `unverified` or `warning` => `BLOCKED`.
3. P1 failures/warnings remain warnings unless explicitly required.
4. Production readiness is true only for outcome `PASS`.

This preserves the distinction between absence of evidence and observed failure while preventing both from being presented as production-ready.

## Components

- `packages/core/src/evidence.ts`: canonical types and evaluator.
- `tests/unit/evidence-engine.test.ts`: TDD contract.
- `scripts/evidence/build-evidence-manifest.mjs`: produces SHA-256 manifests and applies the core evaluator.
- `scripts/network/verify-openai-connectivity.sh`: first real provider transport verifier.
- `.github/workflows/atlas-evidence-engine-ci.yml`: CI proof and artifact publication.
- `docs/network/evidence/`: human- and machine-readable evidence records.

## Evidence bundle schema

A bundle records:

- subject/provider/service;
- environment;
- evidence mode;
- generation timestamp;
- check identifier;
- P0/P1 priority;
- status;
- observation timestamp;
- optional authoritative source/reference;
- optional SHA-256.

The engine rejects malformed timestamps and duplicate check IDs.

## Manifest integrity

The manifest builder hashes the source bundle and attached evidence files with SHA-256. The manifest contains the evaluation result and exact file hashes so a later audit can detect drift or replacement.

## Provider pattern

Every provider adapter should map provider-specific probes into the common evidence contract.

Examples:

- OpenAI: DNS, TLS, HTTPS, WebSocket, upload, Voice UDP, proxy/TLS inspection.
- Cloudflare: zone/deployment revision, Worker route, TLS, public delivery, exact-SHA.
- Supabase: API health, auth boundary, database connectivity, migrations, RLS.
- GitHub: exact commit, checks, CodeQL, branch/release evidence.
- Stripe/payment providers: authenticated account capability, webhook health and reconciliation boundary.

Provider adapters may add checks; they may not redefine the meaning of PASS/BLOCKED/FAIL.

## CI behavior

`npm run verify:all` now includes `npm run verify:evidence`.

The focused Evidence Engine workflow also publishes an artifact named with the exact GitHub SHA. This creates a reproducible evidence chain:

`SOURCE -> CHECKS -> EVALUATION -> SHA-256 MANIFEST -> CI ARTIFACT -> RELEASE/PRODUCTION GATE`

## Production boundary

CI evidence proves repository behavior and the CI runner's observations. It does not prove a different network boundary.

Network/provider production certification must execute probes from the actual egress or runtime being certified. Exact-SHA deployment verification remains a separate mandatory production gate.
