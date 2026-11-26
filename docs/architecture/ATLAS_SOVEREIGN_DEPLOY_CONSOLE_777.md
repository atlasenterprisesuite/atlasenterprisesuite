# ATLAS Deploy — Sovereign Cloud Console (777 REVIEW)

**Status:** draft PR, not merged and not deployed. This is an authenticated **read and controlled draft-write console**. It is NOT a replacement hosting runtime or an authorization to deploy, promote, roll back, change infrastructure, or bypass production gates.

## Goal

Provide a single ATLAS-owned deployment interface inside the existing `/cloud` platform and remove any workflow requirement to use Vercel. The runtime continues to use the existing Cloudflare Workers/static assets path and Supabase control plane. GitHub remains the current source/CI authority; own-hosted alternatives may be future adapters.

**Route:** `/cloud/deploy` (protected via the existing Cloud route boundary).

**Use existing code:**
- `packages/core/src/deploymentControl.ts` (source-SHA and deployment truth rules; adds sovereign read-model)
- `supabase/functions/atlas-infra-status` (ATLAS Manager observed provider readiness and blockers)
- `supabase/functions/atlas-release-control?api=releases` (tenant-scoped releases)
- `apps/web/src/lib/atlasSession.ts` (authenticated session + organization)
- `/cloud/production-verification`, `/release`, `/execution/manager/readiness` (existing verification, releases, and approvals)
- `.github/workflows/cloudflare-deploy.yml` (existing authoritative deployment path, **not** invoked by the console)

## Working functionality in code

1. Authenticated refresh obtains the active ATLAS organization, then **two existing** read APIs concurrently; no new DB tables, provider tokens, staging backend, API keys, deploy jobs or networks are created.
2. Select an existing release and inspect its status and source commit. Release SHA is only recognized if the release source value is exactly a full 40-digit SHA.
3. Resolve a read-only **review_required** or **blocked** state from current tenant-scoped backend evidence (15-minute max freshness), the canonical repo, required Supabase/Cloudflare/Production provider states and server blockers.
4. Treat Vercel as an optional, unused legacy provider. If Vercel becomes required against the sovereign path, fail closed rather than silently accepting it. Optional legacy failures cannot block the required sovereign path.
5. Do not claim any release has reached **verified production** from an infrastructure summary or a green CI status. That requires authoritative exact-SHA runtime and Master Evidence Registry checks by existing release services.
6. Error, revoked auth, missing org, cross-tenant result, stale/invalid provider evidence, no release, noncanonical source SHA, or required provider outage => blocked, no stale data shown.
7. Links to existing Release Control, Manager readiness, production verification, domains and incidents provide execution/review workflows; this slice uses POST solely for authenticated permission checking and explicitly requested **release-create** drafts. It has no deployment triggers, provider mutations, expenses, or public data leaks.

## RUN 008 — Read and controlled-write scope

The read surface still uses the existing tenant-scoped `atlas-infra-status`, `atlas-release-control`, `atlasSession` and deployment-gates APIs. A separate opt-in write panel opens on **Enable controlled writes**.

- On opening the panel, use authenticated `has_identity_permission(o,p)` with `p = releases.create` and the active org ID from `getActiveAtlasOrganization`. No local role/flag grants permission.
- Before each write, re-resolve the authenticated org, verify it matches the snapshot, recheck the server permission and enforce 15-minute evidence freshness. Revoked permissions fail closed.
- Validate release key, version, channel, exact 40-character Git source SHA, and a separate **real 64-character artifact SHA-256**. Refuse blank or placeholder digests; never invent an artifact.
- Build one Cloudflare `web_bundle` component. The existing backend requires at least one component and checks its fields; empty components would be rejected.
- Submit one `atlas-release-control?api=release-create` POST only after **Create release draft** is explicitly selected. The existing server enforces `releases.create` and writes via the original `atlas_create_release_draft` RPC. No client service-role credential is used.
- The organization ID comes from the authenticated backend context, not the draft body. The returned ID is used to refresh and select the draft; it does not certify production.
- No `deployment-create`, `deployment-promote`, rollback, or approvals actions exist in this UI. Privileged MFA and release P0 gates remain obligatory.
- The submitted checksum is provenance **claimed by the submitter**. Existing verification gates must independently validate it before release advancement.

All tests use synthetic commit hashes and checksums. This code change alone does not mutate the production database.

## Readiness and release gates

| Level | Gate | Status |
| --- | --- | --- |
| P0 | Cross-tenant / stale / missing / provider-not-ready evidence blocked | Unit tests authored; CI pending |
| P0 | UI authenticates through ATLAS session; GET reads and protected create-draft POST only | Integration tests authored; CI pending |
| P0 | Vercel is not required, no external Vercel dependency | Static/code review + unit tests; CI pending |
| P0 | Build/typecheck, route integration, security, accessibility, exact-SHA CI | Pending |
| P0 | Manual E2E on Cloudflare with authenticated org, MFA, RLS and real release evidence | Not run |
| P0 | Production exact-SHA verified through existing runtime verifier | Not run; NO-GO |
| P1 | New provider-neutral immutable preview/runtime deployment worker | Later slice, unimplemented |
| P1 | Promotion, deployment, rollback and further privileged write UI | Retain existing Release Control approvals; not enabled in ATLAS Deploy |
| P1 | Separate ATLAS Music Universe #1119 release candidate | Independent draft PR, must not auto-merge or deploy |

**No app or workflow called 'Verse', Vercel clone, or new private deployment service is introduced.** This uses the existing ATLAS Deploy Control Plane with Cloudflare as the production edge.

**Release decision:** P0 NO-GO until exact HEAD passes CI, browser testing passes, and production deployed artifact + runtime SHA evidence is recorded. 777 REVIEW: never confuse a merged PR, healthy build or repo metadata with live production.
