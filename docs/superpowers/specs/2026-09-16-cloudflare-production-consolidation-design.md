# Cloudflare Production Consolidation Design

**Date:** 2026-09-16  
**Status:** Approved design, implementation in progress  
**Repository:** `atlasenterprisesuite/atlasenterprisesuite`

## Objective

Make Cloudflare a stable ATLAS production integration instead of a sequence of per-deploy token and secret changes.

The final operating model uses one reusable Cloudflare production principal, one canonical GitHub `production` environment, one deployment workflow, one preflight contract, and one evidence path. No ATLAS module may introduce its own Cloudflare deployment token or duplicate account configuration.

## Current verified state

The current GitHub Actions workflow can reach Wrangler and the Cloudflare account. The latest Wrangler evidence identifies the configured account as:

- account name: `Winder.aranguren@gmail.com's Account`
- account ID: `1dd6dea2bb98459c66f610464354d686`

The current token is syntactically valid and associated with that account, but Wrangler is denied when attempting the Worker service operation for `atlas-enterprise-suite-web`. The remaining provider-side blocker is therefore Worker authorization for the single production principal, not repository build correctness, token formatting, or account resolution.

Repository verification is already green before the provider boundary: typecheck, unit tests, integration tests, edge verification, Python verification, and production build all pass in the deployment workflow.

## Design principles

1. **One production principal.** ATLAS uses a single Cloudflare Account API Token for durable CI/CD deployment and control-plane operations that are explicitly included in its permission policy.
2. **One mutable secret.** Only `CLOUDFLARE_API_TOKEN` is treated as a secret credential in GitHub production automation.
3. **IDs are configuration, not credentials.** The fixed Cloudflare account ID is stored exactly once in canonical `wrangler.jsonc` as `account_id`; it is not duplicated as a GitHub Secret or Actions Variable. Any future zone ID is configuration and is out of scope until a separately approved zone-scoped feature requires it.
4. **One deployment workflow.** `.github/workflows/cloudflare-deploy.yml` remains the canonical production deployment entry point.
5. **Fail early.** Provider authorization is validated before expensive repository verification whenever doing so does not weaken the repository's security or correctness gates.
6. **No secret proliferation.** The repository must reject or avoid alternate names such as `CF_API_TOKEN`, module-specific Worker tokens, per-feature Cloudflare tokens, or duplicated account credentials in CI.
7. **Provider truth only.** ATLAS Manager records deployment state only from real Cloudflare/GitHub evidence.
8. **No security weakening.** Cloudflare Access, ATLAS Identity, Supabase RLS/RBAC, production/development separation, and existing protected CRM behavior remain unchanged.

## Canonical production configuration contract

### GitHub Environment: `production`

The Cloudflare credential contract is exactly:

- Secret: `CLOUDFLARE_API_TOKEN`

The non-secret account configuration is canonical in `wrangler.jsonc`:

- `account_id`: `1dd6dea2bb98459c66f610464354d686`
- Worker `name`: `atlas-enterprise-suite-web`

No `CLOUDFLARE_ACCOUNT_ID` Secret or Actions Variable is required by the production deployment workflow.

No zone ID is required for the current Worker deployment because `wrangler.jsonc` uses `workers_dev: true` and does not manage a custom route. `CLOUDFLARE_ZONE_ID` must not be added to the canonical production contract until a separately approved zone-scoped automation feature requires it and the real zone identifier is retrieved from Cloudflare.

`CLOUDFLARE_API_TOKEN` must never be stored as a GitHub Actions Variable, committed file, workflow literal, query parameter, artifact, log line, issue, pull-request body, or ATLAS database plaintext.

The account ID is an identifier, not an authentication secret. The design relies on its single canonical placement rather than secrecy.

## Cloudflare principal policy

The single production principal should be an **Account API Token** owned by the ATLAS Cloudflare account rather than a short-lived personal workaround. Cloudflare documents account-owned tokens as suitable durable service principals for CI/CD.

For migration continuity, the authorization preflight may recognize either the currently configured user token or the target Account API Token through the same `CLOUDFLARE_API_TOKEN` secret. This is compatibility for one credential slot, not a second credential namespace. The steady state remains one account-owned production principal.

For the current Worker deployment path, the principal must be able to create and update ATLAS Workers in the target account. The intended steady-state policy is therefore Workers product administration for the ATLAS account, sufficient for initial Worker creation and subsequent deployments without creating another token.

Zone-scoped write permission is not required by the current `wrangler.jsonc`, which deploys `atlas-enterprise-suite-web` with `workers_dev: true` and static assets. If a future approved change makes CI manage custom domains or Worker routes, the same principal may receive the minimum required zone-scoped Workers Routes permission for `atlasenterprisesuite.com`; that is a permission expansion of the same principal, not a new token.

DNS administration is not part of this consolidation unless a separately approved deployment design requires it.

## Repository architecture

### Canonical config

`wrangler.jsonc` remains the canonical Worker definition for:

- Worker name `atlas-enterprise-suite-web`
- Cloudflare `account_id`
- compatibility date
- Worker entry point
- static asset directory and binding
- SPA fallback behavior
- `workers.dev` and preview URL behavior

No second Wrangler configuration file will be introduced for the same production Worker.

### Canonical deployment workflow

`.github/workflows/cloudflare-deploy.yml` remains the only production deployment workflow for the web Worker.

The workflow prefers the stable direct-Wrangler path when the canonical token Secret is present. The Cloudflare native GitHub App may remain as a non-secret fallback/observability mechanism only if it does not create ambiguity about which path is authoritative.

The direct path is authoritative because it produces an explicit Wrangler deployment result, deployment URL, HTTP probes, and ATLAS Manager evidence.

### Preflight

A focused Cloudflare preflight validates before expensive repository verification:

1. the canonical token Secret exists when direct-Wrangler mode is selected;
2. the workflow does not consume the token from a GitHub Actions Variable or alternate token namespace;
3. `wrangler.jsonc` contains the canonical account ID and Worker name;
4. Cloudflare recognizes the supplied token as an active account-owned or migration-compatible user token;
5. the token/account can reach the Worker service operation required by the deployment path;
6. failures are classified as configuration, authentication, authorization, or provider error without exposing credential material.

The preflight must never print the token. It produces concise non-sensitive diagnostics such as `token_valid`, `principal_type`, `workers_authorized`, failure category, and provider error code when available.

### Repository verification and deploy ordering

The final workflow uses this order:

1. checkout/runtime setup;
2. select Cloudflare deployment mode;
3. lightweight Cloudflare authorization preflight for direct-Wrangler mode;
4. locked dependency/native verification setup;
5. `npm run verify:all`;
6. `wrangler deploy --config wrangler.jsonc`;
7. public Worker shell probes;
8. production shell/authorized-runtime probes when applicable;
9. record provider-backed deployment evidence in ATLAS Manager.

A provider credential failure therefore stops before the expensive full verification run. A repository failure must still stop before deployment.

### Cloudflare native build image boundary

The Cloudflare native GitHub App build image does not provide the host media toolchain required by Creator Native (`ffmpeg`, `ffprobe`, and `espeak`). The provider-side `npm run verify:cloudflare` contract therefore runs dependency audit, TypeScript, unit tests, integration tests, edge checks, neural-integrity checks, and the production build, but does not run `verify:python`.

This is not a reduction of the production gate. `.github/workflows/cloudflare-deploy.yml` and `.github/workflows/production-deploy.yml` continue to install the native media toolchain and run the full `npm run verify:all`, including `verify:python`. Production is not considered verified until the repository gate, the Cloudflare deployment, and the final global fail-closed production verification all pass.

## ATLAS Manager and backend integration

Existing Cloudflare status/control-plane code may read the canonical environment names, but it must not invent a second credential namespace.

Where Supabase Edge Functions require Cloudflare control-plane access, the long-term contract is the same canonical Cloudflare principal material propagated through the platform's approved secret-management boundary. Provider credentials must not be returned to the browser or exposed by readiness endpoints.

A future provider-secret synchronization mechanism may automate propagation from the canonical secret store, but that is out of scope unless an available provider integration can perform it without exposing the credential.

## Forbidden configuration patterns

The implementation must reject or remove reliance on:

- `CF_API_TOKEN` as an alternate CI source of truth;
- `CLOUDFLARE_ACCOUNT_ID` as a GitHub Secret or Actions Variable for this Worker;
- per-module Cloudflare tokens;
- per-Worker duplicate tokens for ATLAS-owned Workers unless provider isolation is explicitly required by a later security design;
- duplicated account IDs across workflows/scripts instead of the canonical `wrangler.jsonc` value;
- plaintext Cloudflare tokens in repository files, artifacts, logs, issues, PRs, Supabase tables, or frontend code;
- manual token rotation as a normal deployment step;
- weakening Cloudflare Access or application authorization to make deployment checks pass.

## Token lifecycle

Routine deployments reuse the same production principal.

Token replacement is justified only by:

- planned security rotation;
- token compromise or suspected compromise;
- provider-mandated expiration/revocation;
- ownership/account migration;
- a deliberate security-architecture change.

Adding a new ATLAS module, Worker route, frontend feature, or ordinary deployment is **not** a reason to create another Cloudflare token.

## Failure handling

Cloudflare failures are classified into four categories:

- **configuration:** missing/mismatched canonical account/Worker configuration, including provider code `7003`;
- **authentication:** malformed, revoked, expired, or invalid token, including provider codes such as `9109` or `6111`;
- **authorization:** valid token/account but missing permission for the requested Worker operation, including provider code `10000`/HTTP 403 where applicable;
- **provider/runtime:** Cloudflare API or Worker deployment error after authorization succeeds.

CI reports the category and provider error code when available, while masking credentials and avoiding raw sensitive response bodies.

## Tests

The consolidation must add or update tests that verify:

- the deployment workflow uses the canonical `production` environment;
- the API token is consumed only from `secrets.CLOUDFLARE_API_TOKEN`;
- no alternate Cloudflare token names become CI sources of truth;
- account configuration is pinned once in `wrangler.jsonc` and not consumed from GitHub Secrets/Variables;
- the preflight occurs before `verify:all`;
- `verify:all` still occurs before `wrangler deploy`;
- deployment still uses `wrangler.jsonc`;
- production probes remain after successful deploy;
- no token value can be emitted into logs/evidence;
- ATLAS Manager evidence remains provider-backed and non-secret;
- the Cloudflare provider-native verification script does not require host-only Creator Native media binaries;
- the GitHub production workflows still require `verify:python` through `verify:all` after installing `ffmpeg`, `ffprobe`, and `espeak`.

Full regression gates remain:

- `npm run typecheck`
- `npm run test:unit`
- `npm run test:integration`
- `npm run verify:edge`
- `npm run verify:python`
- `npm run build`
- `npm run verify:all`

## External provider boundary

Repository automation cannot manufacture a Cloudflare credential value. The one-time provider-side requirement is that the canonical production principal exists in Cloudflare with the approved Workers authorization and that its value is stored in GitHub `production` as `CLOUDFLARE_API_TOKEN`.

In the current chat environment, Cloudflare account-management actions and GitHub Secrets write APIs are not exposed. Therefore repository implementation can be completed up to that real security boundary, but creation/editing of the hidden credential itself requires either an authorized Cloudflare account-management connector/Work browser session or one explicit human security action.

Once that single principal is correctly authorized and stored, ordinary ATLAS deploys must require no recurring manual token or secret changes.

## Non-goals

This consolidation does not:

- redesign ATLAS authentication;
- remove Cloudflare Access;
- weaken CRM protection;
- migrate Supabase authentication/session storage;
- add DNS automation without a separate requirement;
- expose provider credentials to ATLAS frontend code;
- create fake production evidence;
- create a separate Cloudflare credential per module.

## Acceptance criteria

The design is complete when:

1. one canonical Cloudflare production principal is documented and enforced;
2. GitHub production automation needs only one Cloudflare secret credential;
3. the account identifier is pinned once as canonical non-secret Wrangler configuration rather than a recurring Secret/Variable;
4. authorization problems fail in a focused preflight before expensive verification;
5. repository verification still blocks deployment on code/test failure;
6. Wrangler remains the authoritative direct deployment path;
7. successful deploys are probed and recorded with real evidence;
8. no ATLAS module requires creation of another Cloudflare token for ordinary deployment;
9. no secret is committed, logged, or surfaced to the browser;
10. existing Cloudflare Access and ATLAS authorization boundaries remain intact.
