# ATLAS Deploy Control Plane — Vercel-class capabilities, provider-neutral

Date: 2026-10-04
Status: implementation foundation
Scope: ATLAS Release Control / ATLAS Cloud / ATLAS Manager

## Objective

ATLAS must not depend on one hosting vendor for deployment truth. The platform should absorb the useful classes of capability exposed by modern deployment platforms—Git-triggered builds, preview environments, serverless/edge execution, routing, caching, scheduled jobs, observability, feature flags, deployment protection, rollbacks, analytics and domain control—while keeping ATLAS evidence rules stricter and providers interchangeable.

This design does **not** claim that ATLAS currently replaces Vercel infrastructure globally. It defines and implements the control-plane foundation that can orchestrate ATLAS-owned infrastructure plus Cloudflare, Supabase, Vercel, self-hosted and future providers without fabricating provider state.

## Capability map

| Platform capability | ATLAS implementation target | ATLAS improvement |
| --- | --- | --- |
| Git deployments | Release Control immutable source SHA | No deployment is detached from source evidence |
| Preview deployments | Ephemeral preview environments | Tenant-scoped, TTL-bound, auto-expiring |
| Serverless / edge functions | ATLAS runtime adapters | Provider-neutral contract and placement policy |
| CDN / cache | ATLAS Edge cache policy | Explicit purge/invalidation evidence and multi-provider failover |
| Routing / middleware | ATLAS Edge routing graph | Versioned routes, staged diff, rollbackable policy |
| Cron jobs | ATLAS Automations scheduler | Idempotency, lease/lock, retry policy, evidence |
| Feature flags | ATLAS governed flags | RBAC, audit, staged rollout and kill switch |
| Observability | ATLAS Observability | Cross-provider normalized traces, logs, costs and SLOs |
| Firewall / bot controls | ATLAS Security policy | Zero Trust, provider adapters, deny-by-default |
| Deployment checks | ATLAS release gates | Fail-closed; alias/promotion cannot occur with red P0 gates |
| Rollback | Verified rollback | Requires target artifact evidence and post-rollback runtime verification |
| Analytics | ATLAS Analytics | Cross-provider, tenant-aware, privacy-governed |
| Domains | ATLAS Domain control | DNS/provider state kept separate from desired state |
| Fluid/serverless scaling | ATLAS capacity policy | Workload-aware placement and budget ceilings |
| AI gateway | ATLAS AI Provider Router | Model/provider federation, cost policy and evidence |

## New deployment-control foundation

The repository now gains provider-neutral deployment contracts in `packages/core/src/deploymentControl.ts`.

The first implementation slice provides:

1. provider-neutral deployment identity;
2. preview/staging/production environments;
3. deployment evidence and truth resolution;
4. exact-SHA production verification;
5. rate-limit-aware queue backpressure;
6. duplicate-build coalescing;
7. concurrency limits;
8. priority scheduling;
9. provider adapter contracts for preview, promote, rollback and verify;
10. a capability catalog for the larger ATLAS Deploy roadmap.

## Rate-limit defense

The immediate Vercel build-rate-limit incident is treated as an orchestration defect, not a reason to weaken release gates.

ATLAS Deploy must:

- coalesce duplicate deployment intents for the same project/SHA/environment/provider;
- cap concurrent provider builds;
- enforce provider-specific cooldown windows;
- never relaunch a provider build merely because another upstream check emitted an event;
- prefer one immutable artifact promoted through environments over rebuilding identical source;
- defer rather than discard work when a provider rate-limits;
- support failover only when the target provider/runtime is actually configured and verified.

## Production truth

Production labels remain evidence-derived.

`verified_production` requires all of:

- source SHA known;
- build verification passed;
- authenticated provider deployment ID;
- provider deployment verified;
- runtime probe verified;
- exact runtime SHA equals the intended source SHA.

A public HTTP 200, successful local build, Git merge, provider dashboard entry, or green UI indicator alone is insufficient.

## Next implementation slices

### Slice 2 — Deployment ledger and queue runtime
Persist deployment intents, cooldowns, attempts, provider IDs, costs and evidence in Supabase with organization RLS. Wire Release Control to the new queue.

### Slice 3 — Preview environments
Generate TTL-bound preview environments with isolated secrets, branch-specific configuration and automatic cleanup.

### Slice 4 — Promotion engine
Promote immutable artifacts preview -> staging -> production using P0/P1 gates, approvals where required, canary/rolling strategies and automatic rollback conditions.

### Slice 5 — Edge + cache control
Versioned routes, rewrites, redirects, cache tags, purge evidence, image policy and multi-edge provider adapters.

### Slice 6 — Scheduled workloads
ATLAS-native cron/scheduled job contracts with idempotency keys, distributed leases, retries, dead-letter evidence and cost ceilings.

### Slice 7 — Governed feature flags
Tenant-aware flags, segments, gradual rollout, emergency kill switch, audit and experiment evidence.

### Slice 8 — Unified observability
Normalize runtime errors, logs, traces, request metrics, deployment metrics, usage and provider cost into ATLAS Observability.

### Slice 9 — Security and domains
Firewall/bot policy adapters, OIDC-based provider auth, trusted source policy, domain/DNS desired-vs-observed state and certificate evidence.

## Non-negotiable gates

- No provider is displayed as connected without authenticated evidence.
- No deployment is displayed as production-verified without exact-SHA runtime verification.
- No failover target is used unless it has passed readiness.
- No rate-limit bypass weakens security or release checks.
- No secret is stored in client-side code or committed to the repository.
- Provider-specific features stay behind adapters; business logic remains ATLAS-owned.
