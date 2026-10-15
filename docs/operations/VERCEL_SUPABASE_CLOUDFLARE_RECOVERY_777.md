# ATLAS 777 — Vercel → Supabase Core → Cloudflare: recovery gate

Status: **HOLD / NOT DEPLOYED**. Scope: non-destructive migration inventory and exact-SHA verification. This document does not authorize copying any suspended third-party database into production or overriding credentials.

## Verified source facts (2026-10-15)

- Git source: `atlasenterprisesuite/atlasenterprisesuite`. The root `package.json` is a Vite workspace monorepo (`apps/web`); `npm run build` creates the static app and deployment manifest.
- The existing GitHub Actions workflow `.github/workflows/cloudflare-deploy.yml` deploys `main` via Cloudflare and checks production readiness. **Reuse this workflow; do not create a parallel pipeline.**
- Vercel project `atlas-enterprise-suite-live`, ID `prj_YAUrbUX0geE8Oe0Q6wYuzDNFSyK9`: latest deployment `dpl_5Ua8XUCsu3C4YCYAfp4oj9Gz7x7y` is `ERROR` in preview.
- Vercel Marketplace resource `supabase-coffee-door`, store `store_RAwm68F5ECrlNc0b`, provider project `drvfsodgmhefjxthkxhi` is **suspended**. It is not ATLAS Core `ggmanzcgtlrvqfoccgsh`.
- Vercel already has integration-managed `SUPABASE_SECRET_KEY` (among other credentials) in preview and production. A second integration attempts to register a duplicate variable. **Do not delete/rewrite either key automatically.**
- Supabase Core target: `ggmanzcgtlrvqfoccgsh`. Confirm workspace/project ownership, migrations, data classification, backup integrity and restore path before importing anything.

## Migration acceptance gates (fail closed)

1. **Inventory and backups**: export Vercel project settings, domain mappings, deployment revisions, environment variable names / scopes / sources (not values), and provider integration metadata. Export source from GitHub; obtain independently restorable PostgreSQL and Storage backups from each authoritative provider with encrypted custody. Check checksum and restore in isolated staging.
2. **Do not treat Vercel hosting as a database**. Reuse existing source. Supabase hosts DB/Auth/Storage/Edge Functions; Cloudflare serves the web frontend and approved workers.
3. **Tenant and auth guarantees**: compare schemas/migrations, preserve identifiers, implement RLS for exposed tables, verify authorization against active tenant roles, and run cross-tenant tests. Never migrate secrets or user data through GitHub issues, commits or logs.
4. **Environment reconciliation**: list keys only; determine canonical prod Supabase ref using an authenticated server-side check. Rotate and store secrets only in approved secret managers, segregated by environment. Fail if two providers are both configured as production truth.
5. **Build and CI**: `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, `npm run build`; then existing Cloudflare workflow with fail-closed P0 production checks.
6. **Exact SHA and runtime**: confirm Cloudflare artifact SHA matches tested `main` SHA; verify public TLS, HTTP, security headers and routes, and database-to-UI E2E behavior. Missing evidence = BLOCKED, never success.

## Explicit release blockers

- Suspended Vercel-managed Supabase resource and unverified contents.
- No authenticated full database/Storage backup or successful restore rehearsal from that resource.
- No confirmation that Cloudflare build/production verification has passed for the target SHA.
- No verified end-to-end tenant and auth checks after migration.

No deletion, transfer, production schema mutation, or domain flip has been performed by this change.
