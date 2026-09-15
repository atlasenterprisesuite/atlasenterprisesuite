# ATLAS Repository Audit Closure — Design

Date: 2026-09-15
Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`
Approved baseline: `main` at `c54a19aec7ca3c4bcda822c28496a3815eb11d7a`

## Objective

Close the repository-level P0/P1 findings from the 2026-09-15 audit without weakening existing tenant, RBAC, audit, Cloudflare Access, Supabase, or provider-truth boundaries. The result must remain one canonical ATLAS system and must not create parallel applications or duplicate control planes.

## Non-negotiable constraints

- `main` remains the canonical branch and production source.
- Changes land through a reviewable branch and pull request.
- No credentials, API secrets, tokens, private keys, passwords, recovery codes, or certificates are committed.
- Existing Cloudflare Access fail-closed verification remains intact.
- Existing Supabase tenant/RLS/RBAC boundaries remain intact.
- Demo data remains explicitly labeled and must never be represented as production data.
- Provider-dependent features remain truthful about unavailable/unverified states.
- Repository-admin settings that cannot be changed through the connected GitHub capability are recorded as external human gates rather than simulated.

## Architecture

### 1. Repository governance as code

Add repository-owned governance documents and automated contracts that define the required `main` policy: pull-request-only changes, required CI, required security analysis, no force push/deletion, review conversation resolution, and verified release provenance. Because GitHub branch/ruleset administration is not exposed by the current connector, the codebase will contain a machine-checkable desired-state contract plus an operator runbook; the actual repository-admin mutation remains an explicit external gate.

### 2. Trusted CI boundary

Pull-request validation must execute on GitHub-hosted runners. Existing feature workflows that currently execute PR code on `self-hosted` are changed so PRs use `ubuntu-latest`; self-hosted execution remains only for explicit/manual or trusted-branch verification. Production deploy continues on GitHub-hosted infrastructure.

### 3. Single verification contract

Introduce a root `verify:all` contract covering dependency audit, TypeScript, unit tests, integration tests, Python Creator Native tests, static checks for Supabase Edge Functions/migrations, and production build. The production-readiness and Cloudflare workflows call the same contract or equivalent exact steps so a passing release cannot omit a repository-owned runtime family.

### 4. Browser and edge hardening

The Cloudflare Worker remains the protected application perimeter. Successful authenticated asset responses receive security headers including CSP, HSTS, X-Content-Type-Options, Referrer-Policy and Permissions-Policy. Existing RS256/JWKS/issuer/audience/expiry verification is preserved.

Browser session behavior is hardened without an incompatible auth rewrite in this closure: persisted session storage is centralized behind one adapter, refresh-token persistence is explicitly documented as a residual risk, and a follow-on migration path to an HttpOnly/BFF-style session is documented. A complete cookie/BFF conversion is intentionally not attempted without a backend session issuance contract because fabricating one would weaken correctness.

### 5. Canonical module registry

Create a single typed module registry for the currently implemented top-level ATLAS modules. It owns route prefix, title, area, readiness and whether authentication is required. The enterprise home consumes this registry for module cards; existing module-specific routers remain intact. This is an incremental convergence layer, not a rewrite of `App.tsx` in one change.

### 6. Demo/production truth boundary

Accounts Payable must continue to distinguish authenticated Supabase data from demo data. Demo fallback is allowed only when explicitly labeled; no live/connected language may be derived from demo state. This closure adds a regression contract rather than removing the useful demo mode.

### 7. Supply-chain and repository hygiene

Add `SECURITY.md`, `CONTRIBUTING.md`, `CODEOWNERS`, and `.gitignore`; pin repository-owned GitHub Actions to immutable commit SHAs where reliable exact SHAs are available through GitHub metadata, otherwise preserve major-version references and document the remaining pinning gate rather than invent SHAs. Remove no provider or deployment adapter solely for cleanliness. `vercel.json` stays as a legacy optional adapter but is explicitly documented as non-canonical.

### 8. Historical branch/PR convergence

Do not bulk-merge `release/atlas-a-z` or other historical branches. Add a convergence register that classifies large historical work as `active`, `salvage`, `superseded`, or `external-gated`, with the rule that unique capability is recovered through focused PRs based on current `main`.

## Testing and acceptance

A closure PR is acceptable only when:

1. `npm ci` succeeds.
2. dependency audit at `high` succeeds.
3. TypeScript typecheck succeeds.
4. unit tests succeed.
5. integration tests succeed.
6. Python Creator Native tests succeed.
7. production Vite build succeeds.
8. Worker security-header contract tests succeed without weakening Access JWT checks.
9. module-registry tests prove unique route prefixes and truthful readiness metadata.
10. PR workflows no longer execute untrusted pull-request code on self-hosted runners.
11. no new secret-like committed values are introduced.
12. Cloudflare production workflow verifies the exact merged SHA and records ATLAS Manager evidence.

## External gates

The following cannot be truthfully completed only through repository file changes with the currently connected capabilities:

- turn on GitHub `main` branch/ruleset enforcement in repository administration;
- enable/verify any provider-side Supabase Auth setting not exposed to the connector;
- complete a human privileged MFA enrollment if still pending.

These gates must be reported precisely and must not block independent repository hardening.