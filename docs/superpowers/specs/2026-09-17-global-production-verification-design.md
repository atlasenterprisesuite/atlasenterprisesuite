# ATLAS Global Production Verification Design

**Date:** 2026-09-17  
**Status:** Approved by the owner's global-deployment direction  
**Repository:** `atlasenterprisesuite/atlasenterprisesuite`

## Objective

Create one provider-neutral production verification plane that every ATLAS deployment path can invoke before the deployment is considered verified. The gate must verify the canonical public domain and critical ATLAS Network routes after deployment and fail closed by default.

Cloudflare remains the canonical web edge. This design does not claim that AWS, Google Cloud, Oracle, or sovereign regional runtimes are provisioned until provider-backed evidence exists.

## Required production contract

Canonical production origin:

- `https://www.atlasenterprisesuite.com`

Required public shell routes:

- `/`
- `/identity?app=%2Ffinance`
- `/finance`

Critical ATLAS Network routes:

- `/business/network`
- `/business/network/pricing`
- `/business/network/commissions`
- `/business/network/payouts`
- `/business/network/compliance`

Protected deployment evidence route:

- `/deployment.json` must remain protected and return one of `302`, `401`, or `403` when probed without credentials.

Redirects from required public routes must remain HTTPS and same-origin. Cross-origin redirects fail the gate.

## Modes

### `fail-closed`

Default and production mode. Any required public route failure, protected-route regression, cross-origin redirect, timeout, network error, or unresolved Cloudflare challenge makes the gate fail and return a non-zero exit status.

### `warning-only`

Explicit diagnostic mode only. The verifier records failures but returns success so operators can inspect results without blocking a non-production experiment. Production workflows must not select this mode by default.

## Provider-neutral verifier

Add `scripts/verify-global-production.mjs` as the portable verification entry point.

The script:

1. reads the shared production contract from `data/ops/global-production-verification.json`;
2. accepts an optional base URL override for controlled validation;
3. enforces HTTPS and same-origin redirects;
4. retries transient network failures with bounded timeouts;
5. classifies Cloudflare browser challenges without treating them as success;
6. writes a machine-readable result when requested;
7. exits non-zero in `fail-closed` mode when verification is not complete.

A classified Cloudflare challenge may be deferred only when the caller explicitly requests authorized fallback. Deferral is not a pass; the caller must complete the authorized runtime verification before promotion.

## GitHub reusable workflow

Add `.github/workflows/global-production-verify.yml` with three supported entry paths:

- `workflow_call` for provider-specific ATLAS deployment workflows;
- `workflow_dispatch` for explicit post-deployment verification;
- successful GitHub `deployment_status` events targeting the production environment.

The workflow uses `fail-closed` by default and runs the provider-neutral verifier after checkout. If the direct public probe is blocked only by a classified Cloudflare challenge, it obtains a GitHub OIDC token and calls the existing authorized Supabase production verifier. The workflow succeeds only when either the direct verifier passes or the authorized fallback verifies all required production checks.

## Authorized runtime scope

`supabase/functions/atlas-cloudflare-production-http-verify/index.ts` currently accepts GitHub OIDC only from the canonical Cloudflare deployment workflow on `main`.

Extend the allow-list to accept both:

- `.github/workflows/cloudflare-deploy.yml@refs/heads/main`
- `.github/workflows/global-production-verify.yml@refs/heads/main`

All existing OIDC issuer, audience, repository, owner, branch, expiration, and signature checks remain mandatory. No wildcard workflow authorization is allowed.

## Cloudflare integration

The current Cloudflare workflow already performs a strong provider-specific deployment verification and records evidence. It remains authoritative for Cloudflare deployment completion.

The global workflow is an additional reusable post-deployment gate, not a replacement for Cloudflare preflight, Wrangler/native-provider evidence, or ATLAS Manager evidence recording.

Future AWS, Google Cloud, Oracle, Vercel, VPS, or sovereign deployment workflows must call the global verifier after their provider-specific deployment succeeds and before they report ATLAS production verification.

## Shared configuration

`data/ops/global-production-verification.json` is the single source of truth for the public production route contract used by the portable verifier and repository contract tests.

The Supabase authorized verifier may keep executable route constants inside its Edge Function bundle, but tests must prove that its required routes stay aligned with the shared contract. This avoids depending on runtime access to repository files outside the deployed Edge Function while still preventing route drift.

## Evidence and security

The verifier must never print or persist credentials. Direct HTTP verification needs no secret. Authorized fallback uses short-lived GitHub OIDC and returns only verification status and non-secret probe metadata.

The gate must preserve Cloudflare Access/edge policy, ATLAS Identity, backend bearer enforcement, RBAC, RLS, and tenant isolation. It must never weaken security controls to make a health check pass.

## Worldwide deployment interpretation

Cloudflare Workers provides the globally distributed web-edge execution layer for the canonical ATLAS web application. The existence of a global edge does not by itself prove regional data residency, local failover, or multi-cloud runtime deployment.

Regional control/data planes for Americas, Europe, Latin America, and Asia-Pacific remain later deployment phases. Each phase must produce provider-backed infrastructure evidence and must consume this same global production verification contract before being marked production verified.

## Tests

Repository tests must verify:

- the production contract contains the canonical domain and all critical routes;
- `fail-closed` is the default mode;
- the portable verifier rejects missing/failed required checks and cross-origin redirects;
- warning-only is explicit;
- the reusable workflow supports `workflow_call`, `workflow_dispatch`, and production `deployment_status` verification;
- the reusable workflow uses authorized fallback only for a classified edge challenge;
- the Supabase verifier authorizes exactly the canonical Cloudflare and global verification workflows;
- critical ATLAS Network routes remain synchronized between the shared contract and authorized runtime verifier;
- `package.json` exposes a portable production verification command.

## Acceptance criteria

1. Any deployment method can invoke one repository-owned production verification command or reusable workflow.
2. `fail-closed` is the default.
3. `www.atlasenterprisesuite.com` is always verified after a production deployment before success is claimed.
4. All five critical ATLAS Network routes are required.
5. Cross-origin redirect, timeout, unexpected status, protected-route regression, or unresolved challenge blocks production verification.
6. Cloudflare challenge fallback preserves edge security and uses narrowly scoped GitHub OIDC.
7. Existing Cloudflare deployment evidence remains intact.
8. No unprovisioned cloud region is represented as deployed or verified.
