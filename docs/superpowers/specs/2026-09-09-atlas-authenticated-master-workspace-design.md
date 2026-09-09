# ATLAS Authenticated Master Workspace Design

**Date:** 2026-09-09  
**Status:** Approved for implementation  
**Repository:** `atlasenterprisesuite/atlasenterprisesuite`  
**Integration base:** `release/atlas-a-z`

## Purpose

Convert the public ATLAS product catalog shown in the approved visual reference into the authenticated enterprise workspace without replacing the existing public site or creating a parallel ATLAS application.

The protected application boundary is:

`public site → /identity → /app → governed module routes → Supabase → ATLAS Manager → release gates → Cloudflare`

The public site remains public. Business records remain behind Supabase Auth, tenant/organization scope, RBAC/RLS and audit boundaries.

## Product modules

The authenticated launcher must expose these 18 approved product modules as canonical product names:

1. ATLAS HR
2. ATLAS Payroll
3. ATLAS Finance
4. ATLAS ERP
5. ATLAS Pay & Wallet
6. ATLAS Health
7. ATLAS Education
8. ATLAS Analytics
9. ATLAS Connect
10. ATLAS Documents
11. Knowledge Atlas
12. ATLAS Security
13. ATLAS Identity
14. ATLAS Projects
15. ATLAS Studio
16. ATLAS Workbench
17. ATLAS RideOS
18. ATLAS Global

A launcher tile is not evidence that a module is production-complete. Each tile resolves its runtime state from the governed module catalog and organization scope. States such as `live`, `connected`, or `verified` may only be shown when provider/runtime evidence exists.

## Architecture

### Public and private route boundary

- `/` remains compatible with the public/application entry behavior already used by ATLAS.
- `/identity` is the explicit authentication surface.
- `/app` is the authenticated enterprise home.
- `/app/<module>` contains canonical product routes.
- Existing legacy deep links such as `/finance`, `/people`, `/health`, `/operations`, `/voice` and `/telecom/...` remain valid through redirects or aliases during migration.

### Identity and master access

ATLAS Auth must use the configured Supabase client. Passwords are entered only in the browser's password input and passed directly to Supabase Auth. ATLAS application code must not log, persist separately, commit, email or expose the password.

The initial A-Z backend is `atlas-core-v2`. It currently contains the verified v2 foundation but no production auth user or tenant records. Therefore the final activation of Winder's account is a separate human-in-the-loop bootstrap gate after the secure identity route is deployed. The user will enter their own password; no password will be requested in chat.

Inside a tenant, `owner` is the master business role. Platform-wide administration must be represented separately from ordinary organization permissions when the backend supports it; it must not be simulated by bypassing RLS.

### Module mapping and reuse

The authenticated product modules reuse existing A-Z capabilities rather than duplicating them:

- HR → existing People / HR domain
- Payroll → existing People Payroll domain
- Finance → existing Finance + Accounting domain
- ERP → existing Revenue/Operations hub and governed operational domains
- Health → existing Health routes
- Analytics → governed analytics/revenue/accounting surfaces as implemented
- Projects → existing Projects capability under Revenue Ops
- Workbench → release/automation/site-review/spatial operational tools, surfaced as a governed developer/operations hub
- Studio → creator/voice surfaces already present plus future verified media providers
- Remaining product modules use the same shell, module registry, permission boundary and data-source pattern; missing capabilities are implemented as separate bounded subprojects rather than as fake dashboards.

### Module catalog

A single typed frontend catalog owns product metadata:

- `id`
- `displayName`
- `route`
- `moduleCodes`
- `permissionCodes`
- `category`
- `description`
- `implementationState`

The shell and home launcher consume the same catalog so navigation cannot drift from the product grid.

### Truthful runtime state

Frontend availability is the intersection of:

1. product implementation exists,
2. user has permission,
3. organization module is enabled when applicable,
4. required provider/backend is configured,
5. runtime evidence supports the status shown.

If a capability is not implemented or not configured, ATLAS shows a precise configuration/availability state. It does not invent KPIs, provider connectivity or production readiness.

## Data and permissions

All business reads/writes remain tenant + organization scoped. Existing v2 repositories and governed RPCs are reused. New DDL is introduced only when a required domain has no approved schema. Direct client writes stay prohibited where governed RPC patterns already exist.

The frontend must never infer permissions from email address. Email can identify the signed-in account in UI, but authorization comes from Supabase identity context, role permissions, organization overrides and any approved platform-admin contract.

## UI behavior

The authenticated shell must provide:

- ATLAS branding
- responsive sidebar / compact mobile navigation
- active route state
- organization context
- authenticated user context
- sign-out action
- product launcher grid
- visible capability state
- loading, configuration-required, authentication-required, authorization/organization-required and error states

The first implementation slice restores the secure identity page, introduces `/app`, creates the unified module catalog and maps all 18 product names to canonical routes without removing deeper existing routes.

## Testing

TDD is required for every behavior change.

Foundation acceptance coverage:

- `/identity` accepts credentials through Supabase Auth and never stores the password outside the auth call/session mechanism.
- safe internal `app` return targets are preserved; external/recursive targets fail closed.
- unauthenticated `/app` resolves to the identity boundary.
- authenticated context exposes user and organization safely.
- all 18 product modules exist once in the canonical catalog.
- shell navigation and launcher derive from the same catalog.
- permission/module-state filtering fails closed.
- legacy routes continue to resolve.
- build, typecheck, unit and integration suites pass before merge.

## Deployment gates

A successful build is not a deployment claim. Promotion requires:

1. feature branch tests pass,
2. PR to `release/atlas-a-z` passes ATLAS Forge gate,
3. integration branch verification passes,
4. approved promotion to `main`,
5. Cloudflare deployment evidence,
6. public `/identity`, `/app` and smoke-route verification,
7. secure user activation/bootstrap in `atlas-core-v2`,
8. authenticated master/owner route verification.

Production is only marked complete after those gates provide evidence.