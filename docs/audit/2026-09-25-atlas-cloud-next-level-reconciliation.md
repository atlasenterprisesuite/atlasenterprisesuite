# ATLAS Cloud Next-Level Reconciliation — 2026-09-25

## Decision

The Deep Research report is accepted as product direction, but implementation is reconciled to the actual ATLAS production architecture before code is added.

ATLAS Cloud must extend existing authorities rather than create parallel stores or control planes.

## Existing authorities confirmed

- Project management: `public.projects`, `public.project_tasks`, `public.project_milestones`.
- Execution projects: `public.atlas_work_projects`.
- Service inventory: `public.atlas_module_registry`.
- Audit: `public.audit_logs`.
- Traces: `public.atlas_trace_spans`.
- Operational metrics: `public.atlas_operational_metrics`.
- Release/deployment truth: `public.atlas_releases`, `public.atlas_deployments`, Release Control.
- Native observability: deployed `atlas-observability` Edge Function.
- Infrastructure readiness: `atlas-infra-status` / ATLAS Manager.
- Public production verification: global fail-closed route contract plus authorized Cloudflare verification fallback.

## Reconciled implementation

### API Explorer

ATLAS ships its own authenticated OpenAPI 3.1 explorer at `/cloud/api-explorer`.

The first interactive operations are deliberately read-only:
- resource inventory;
- observability summary.

The explorer describes the canonical browser operations over Supabase Data API and the existing ATLAS observability function. Interactive execution is deliberately limited to approved read-only operations.

No API token or session credential is rendered into the response panel.

### Observability

`/cloud/observability` consumes the existing `atlas-observability` authority. It does not create `logs`, `metrics` or `traces` tables.

External OpenTelemetry/Grafana export remains an optional extension. It is not required for this release because ATLAS already has live organization-scoped telemetry and incident evidence.

### Resource Manager

`/cloud/resources` uses:
- `public.projects` as the organization project authority;
- `public.project_tasks` and `public.project_milestones` for project detail;
- `public.atlas_module_registry` as the service authority.

Project creation is performed directly through the canonical Supabase Data API using `authorizedAtlasFetch`, the current ATLAS user session and active organization. Existing RLS decides whether the operation is allowed.

No service-role credential is used by Atlas Cloud.

### Visual service management

The initial service map groups registered modules by their existing `data_backend` value and distinguishes active from limited/blocked registry state.

A project-to-service assignment relation is intentionally not invented in this increment. It should be introduced only when a canonical association contract is approved.

## Security boundaries

- Protected routes remain behind `RequireAtlasIdentity`.
- Browser requests use the existing ATLAS session helper, Supabase publishable configuration and the user's Bearer session.
- Database access uses the user's JWT, active organization and existing RLS.
- No secret, recovery code, password or service-role value is returned to the browser.
- Existing observability permissions remain authoritative.
- Production verification remains fail-closed.

## Zero-cost deployment constraint

The active Supabase project is at its current Edge Function count limit. Creating a new `atlas-cloud-control` function would require a paid capacity change or deleting an existing stable function.

ATLAS does neither. The next-level Cloud surfaces use the already-supported browser Data API path with user JWT + RLS, while observability reuses the already-deployed `atlas-observability` function. This preserves the zero-additional-provider-cost requirement and avoids removing stable runtime functions.

## Production contract

The following SPA routes are required by the shared production route contract and by the authorized runtime verifier:

- `/cloud/api-explorer`
- `/cloud/observability`
- `/cloud/resources`

A build or merge is not production evidence. The routes are production-verified only after the normal Cloudflare/main deployment and global fail-closed verification converge on the exact main SHA.

## Deferred by design

- Grafana/Loki/Prometheus deployment.
- Browser OpenTelemetry instrumentation.
- New raw log/metric/trace stores.
- A second service registry.
- Project-to-service join data model.
- Destructive resource operations.
- A dedicated Atlas Cloud Edge Function slot unless future capacity is intentionally added.

These remain optional later phases and are not blockers for the native ATLAS Cloud control surfaces delivered by this increment.
