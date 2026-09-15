# ATLAS Cloudflare — Production Control Audit Addendum

Date: 2026-09-13
Production domain: `atlasenterprisesuite.com` / `www.atlasenterprisesuite.com`
Backend authority: Supabase `atlas-core`

## Current truth

1. The public `www` hostname is currently intercepted by Cloudflare Access. Anonymous public/commercial verification therefore fails.
2. The most recent ATLAS `infrastructure-public` verifier remains blocked with `cloudflare_access_service_token_required`.
3. ATLAS Manager has a real Cloudflare bootstrap/control implementation that can verify a Cloudflare API token, resolve the account/zone, create a path-scoped Access application for `www.atlasenterprisesuite.com/deployment.json`, create a service token, store its one-time credentials in Supabase Vault, create/update a non-identity service-auth policy, and record verification evidence without returning secrets.
4. The last recorded control-plane bootstrap attempt reached `api_token_rejected` / `Invalid request headers` with `api_token_configured=true`.
5. Fresh Vault inspection shows:
   - `cloudflare_api_token`: absent;
   - `cloudflare_zone_id`: absent;
   - `cloudflare_account_id`: absent;
   - Cloudflare Access service-token credential set: absent.
6. The active runtime environment therefore contains or previously contained a Cloudflare credential outside ATLAS Vault, but the last verified attempt rejected it. This credential must not be assumed valid.
7. Legacy one-shot `atlas-cloudflare-reconcile-once` and `atlas-cloudflare-route-cutover-once` functions are intentionally disabled with HTTP 410. They must not be revived as an unaudited shortcut.
8. Historical deployment evidence records Cloudflare build success for source commit `305f9b54816fcb89ff6e6271b289fd5a42faf15d`, while the public artifact check was still blocked by Cloudflare Access. This is not evidence that current `main` is deployed.

## Architectural ruling

The commercial/public and authenticated/private surfaces must be separated.

Recommended canonical edge model:

- `https://www.atlasenterprisesuite.com` — public marketing, product/module pages, legal pages, contact/request-demo and public status/health material intended for customers.
- `https://app.atlasenterprisesuite.com` — authenticated ATLAS Enterprise workspace protected by Cloudflare Access/ATLAS Identity as appropriate.
- machine-only verification path(s), such as `/deployment.json`, may remain protected by a narrow service-token policy.

This preserves Zero Trust instead of weakening it while restoring a public commercial website.

## Required closure sequence

1. Provision/rotate one valid least-privilege Cloudflare API token with only the permissions required by the ATLAS Manager bootstrap/control path.
2. Store the token and authoritative zone/account identifiers through the ATLAS Vault control function or an equivalent authorized secret-management path. Never commit or echo credentials.
3. Verify the token with Cloudflare before any mutation.
4. Run the governed `atlas-cloudflare-bootstrap?api=reconcile` flow using the ATLAS runtime-verifier authorization boundary.
5. Confirm the service-token secret was stored successfully in Vault and never returned to the client.
6. Re-run the canonical public/deployment verifier and record fresh evidence.
7. Implement/verify the public `www` versus protected `app` Access policy split.
8. Deploy the exact intended current-main release through the approved Cloudflare path.
9. Verify `/`, required public pages, app auth boundary, selected module routes, `/healthz`, TLS/DNS/redirect policy and exact release identity.

## Current blocker classification

**EXTERNAL AUTHORIZATION / CREDENTIAL BLOCKER.**

ATLAS code contains a bounded control path, but no currently valid Cloudflare control credential is proven in ATLAS Vault, and the last environment credential was rejected. No production DNS/Access mutation should be performed until a valid credential is established and verified.
