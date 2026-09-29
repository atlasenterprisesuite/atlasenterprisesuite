# ATLAS Cloud Truth Status Contract

Effective date: 2026-09-29
Status: Approved architecture contract
Scope: ATLAS Cloud, ATLAS Manager, Release Control, provider adapters, public verification surfaces

## Purpose

ATLAS Cloud must never represent a component as healthy, connected, ready, deployed, verified, approved, paid, signed, printed, shipped, fulfilled, or production-ready unless the corresponding state is backed by current evidence.

This contract defines the canonical user-facing status model for ATLAS Cloud and the minimum evidence required to render each state.

## Canonical states

### ✅ VERIFIED

Use only when the exact component or gate has current evidence proving the claimed state.

Minimum requirements:
- the target resource is unambiguously identified;
- the relevant verification completed successfully;
- evidence includes a timestamp;
- evidence identifies the provider, release, build, commit, resource or route being verified;
- evidence is not superseded by a newer failure;
- for production claims, the public runtime is checked independently from source/build success.

Examples:
- canonical commit SHA is deployed and the public route serves that release;
- a required database migration is present in the authoritative project;
- a production route returns the expected healthy response;
- a required provider reports the expected resource state.

### 🟡 IN PROGRESS

Use when work is actively represented in source, configuration or execution evidence but final verification has not completed.

This state must not be rendered as successful or production-ready.

Examples:
- build passed but deployment evidence is pending;
- deployment request was accepted but runtime verification is pending;
- provider configuration exists but live connectivity has not been verified;
- a migration or security repair exists on a branch but is not yet applied to production.

### ⚠️ WARNING

Use only for a verified non-blocking issue.

A warning must include:
- the affected component;
- the evidence supporting the warning;
- why it is non-blocking;
- the next remediation action.

P1 warnings do not block a release unless release policy explicitly promotes that gate to required.

### ❌ BLOCKED / FAILED

Use when a required P0 gate fails or a required dependency prevents verified completion.

Examples:
- required route returns 4xx/5xx;
- production health check fails;
- required provider is unavailable;
- required migration or security control is missing;
- deployment cannot be traced to the canonical release;
- required DNS/TLS assertion fails.

Fail-closed behavior:
- a P0 failure prevents production verification;
- unrelated independent work may continue;
- the failing gate remains red until new evidence proves recovery.

### 🔒 NEEDS AUTHORIZATION

Use only when the next executable step requires an external permission, credential, MFA step, provider approval, billing decision, legal approval or other user-controlled authorization that ATLAS cannot legitimately perform with current authority.

This state must identify the exact dependency without exposing secret material.

Examples:
- provider OAuth consent is required;
- MFA registration must be completed;
- a production secret must be added in an approved secret store;
- an account-level security setting requires owner access.

## Evidence hierarchy

When evidence conflicts, ATLAS Cloud uses the following precedence:

1. current public runtime verification;
2. current provider-native state;
3. current backend/control-plane verification;
4. deployment evidence;
5. CI/build evidence;
6. source/configuration presence;
7. documentation or intended design.

A lower layer cannot override a contradictory higher layer.

Example: a successful GitHub build does not override a failing production route.

## Required production path

Default required path:

GitHub -> Supabase -> Cloudflare -> Production verification

Vercel and other providers remain optional unless explicitly selected by the active release.

Optional-provider failures must not lower required-path readiness unless that provider is part of the active release contract.

## P0 release gates

ATLAS Cloud must fail closed on these gates when applicable:

- canonical source/release identification;
- authoritative backend availability;
- required migrations;
- tenant/RLS/security gates;
- required Edge Functions or backend APIs;
- frontend deployment evidence;
- root public route;
- required critical module routes;
- health endpoint;
- DNS resolution;
- TLS validity;
- expected-domain routing;
- exact release/build traceability.

## P1 warning gates

Typical warning-only checks may include:

- optional provider disconnected;
- non-critical documentation route unavailable;
- non-blocking performance advisory;
- degraded optional telemetry;
- non-critical integration not configured.

A P1 item must never be silently converted to green.

## UI rendering rules

- Never infer a green state from configuration presence.
- Never use a checkmark for "configured", "created", "requested" or "deployment accepted" unless the claim being displayed is exactly that narrow fact.
- Show the evidence timestamp or evidence drill-down for VERIFIED states.
- Show the blocking reason and next action for BLOCKED states.
- Show the exact authorization dependency for NEEDS AUTHORIZATION states.
- Accessibility: the meaning of a state must be available as text and must not depend on color or emoji alone.

## State-transition rules

Allowed examples:

IN PROGRESS -> VERIFIED
IN PROGRESS -> BLOCKED
BLOCKED -> IN PROGRESS -> VERIFIED
WARNING -> VERIFIED
NEEDS AUTHORIZATION -> IN PROGRESS -> VERIFIED

Disallowed examples:

configured -> VERIFIED without verification
build success -> production VERIFIED without runtime evidence
provider token present -> connected VERIFIED without provider evidence
deployment accepted -> production VERIFIED without public verification

## Audit requirements

Every transition to VERIFIED for a P0 gate must preserve non-secret evidence containing, as applicable:

- timestamp;
- actor or automation context;
- provider;
- environment;
- tenant / organization scope;
- release ID;
- commit SHA / artifact digest;
- resource identifier;
- verification method;
- result;
- superseded evidence relationship.

## Implementation requirement

ATLAS Cloud, ATLAS Manager, Release Control, deployment workflows and future provider adapters must reuse this state model rather than inventing incompatible local status semantics.

The status contract is intentionally provider-neutral and should be mapped to provider-specific raw states only at the adapter boundary.
