# ATLAS Identity + Voice Access Design

## Status
Approved in chat on 2026-09-06 for architectural direction. This document defines the production-safe foundation required to make `/identity?app=/studio/voice` and `/studio/voice` real ATLAS routes without fabricating authentication, permissions, organization membership, or provider connectivity.

## 1. Goal
Enable a real ATLAS Identity boundary that can authenticate a user through an authorized identity provider, resolve tenant and organization scope, evaluate role/module permissions, and safely route an authorized user into ATLAS Voice Studio.

The target flow is:

`/identity?app=/studio/voice` → session resolution → organization scope → RBAC/module authorization → safe redirect → `/studio/voice`.

## 2. Current Repository Reality
The active web application currently exposes Finance and Health routes from `apps/web/src/App.tsx`. `packages/core` contains only a demo tenant/organization context and accounting-specific permissions. `vercel.json` rewrites only Finance and Health application routes. There is no production identity provider adapter, session store, `/identity` route, or `/studio/voice` route in the connected repository snapshot.

Therefore, access cannot be solved by merely toggling a frontend permission. Identity and Voice must be introduced as governed ATLAS Core capabilities.

## 3. Scope
This milestone includes:

- A provider-neutral ATLAS Identity domain in `packages/core`.
- User, session, tenant, organization, role, permission, and module-access contracts.
- Generic permission evaluation not tied to Accounting.
- Safe return-path validation for `app=/studio/voice`.
- Identity route UI with explicit authenticated, unauthenticated, loading, denied, and provider-unconfigured states.
- Protected route enforcement for `/studio/voice`.
- ATLAS Voice Studio shell showing only capabilities actually implemented in this repository.
- Vercel SPA rewrites for `/identity/*` and `/studio/*`.
- Unit and integration tests for access control and route behavior.
- Existing ATLAS 3-of-3 consensus CI gates remain mandatory before production.

This milestone does not include:

- Inventing credentials or silently creating a production account.
- Pretending a provider such as Supabase, Auth0, Clerk, Firebase, or Cloudflare Access is configured when it is not.
- Fabricating a live voice model, telephony carrier, microphone session, or speech provider connection.
- Replacing existing Finance or Health authorization behavior with weaker client-side-only checks.

## 4. Architecture

### 4.1 ATLAS Core Identity
`packages/core` becomes the shared contract owner for identity and authorization.

Core types:

```ts
export type AtlasModuleId =
  | 'finance.accounting'
  | 'health'
  | 'studio.voice';

export type AtlasPermission =
  | 'accounting.read'
  | 'accounting.write'
  | 'accounting.post'
  | 'accounting.close'
  | 'accounting.admin'
  | 'audit.read'
  | 'studio.voice.read'
  | 'studio.voice.use'
  | 'studio.voice.admin';

export type AtlasUser = {
  id: string;
  email: string;
  displayName: string;
};

export type AtlasSession = {
  user: AtlasUser;
  scope: TenantScope;
  roles: string[];
  permissions: AtlasPermission[];
  modules: AtlasModuleId[];
  issuedAt: string;
  expiresAt: string;
};
```

Permission evaluation is generic:

```ts
export function hasPermission(
  granted: readonly AtlasPermission[],
  required: AtlasPermission
): boolean;
```

Module access is checked independently from permissions so a user cannot enter Voice only because a permission string was accidentally granted while the module is disabled.

### 4.2 Identity Provider Boundary
The frontend consumes a provider-neutral interface:

```ts
export type AtlasIdentityState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'authenticated'; session: AtlasSession }
  | { status: 'denied'; reason: string }
  | { status: 'unconfigured'; reason: string };

export interface AtlasIdentityProvider {
  getState(): Promise<AtlasIdentityState>;
  signIn(returnPath: string): Promise<void>;
  signOut(): Promise<void>;
}
```

No provider-specific SDK is added until an authorized provider and its environment configuration are verified. The default repository implementation must report `unconfigured`, never a fake authenticated session.

### 4.3 Safe Return Path
The `app` query parameter is treated as an internal return path, not an arbitrary URL.

Accepted example:

`/identity?app=/studio/voice`

Rejected examples include absolute URLs, protocol-relative URLs, encoded external URLs, and paths outside the ATLAS route allowlist.

The validator returns `/` when the requested destination is unsafe.

### 4.4 Route Guard
A reusable `ProtectedRoute` performs three checks in order:

1. A valid authenticated ATLAS session exists.
2. The session includes the requested module.
3. The session includes the required permission.

For Voice Studio, the required contract is:

- module: `studio.voice`
- permission: `studio.voice.use`

Unauthenticated users are redirected to `/identity?app=/studio/voice`.
Authenticated but unauthorized users receive an access-denied state and are not redirected in a loop.
Provider-unconfigured environments show a configuration boundary and do not claim login is available.

## 5. Web Routes

### `/identity`
Responsibilities:

- Read and validate `app`.
- Resolve current identity state.
- Show loading while resolving.
- Show sign-in action only when a provider is configured and the user is unauthenticated.
- Redirect authenticated and authorized users to the safe requested application.
- Show explicit denial when authenticated but lacking organization/module/permission scope.
- Show explicit configuration state when no provider is wired.

### `/studio/voice`
Responsibilities:

- Require `studio.voice` + `studio.voice.use`.
- Render ATLAS Voice Studio inside the existing global shell.
- Present only repository-backed capabilities.
- If no live voice runtime/provider is configured, show a truthful setup/empty state rather than a simulated connection.

## 6. Voice Studio Milestone UI
Voice Studio is introduced as a governed application shell, not a fake voice engine.

Initial sections:

- Session/authorization status.
- Organization context.
- Voice runtime status.
- Provider status.
- Device capability status.
- A disabled primary voice action when no real runtime is configured, with a clear explanation of the missing dependency.

No metric, online indicator, microphone connection, carrier state, latency figure, model name, or session count is shown as live unless sourced from a verified integration.

## 7. Data and Security Rules

- Tenant and organization scope remain mandatory for authenticated sessions.
- Authorization is deny-by-default.
- Unknown permissions and modules never grant access.
- Return paths are validated before navigation.
- Session expiration is honored.
- Identity provider configuration comes from environment/runtime configuration and is never committed as a secret.
- Client-side route guards are UX controls, not the sole protection for future sensitive APIs. Any future Voice backend endpoint must repeat server-side authorization.
- No cross-tenant data is cached or reused across sessions.
- Audit hooks are part of the contract for future sensitive operations; this milestone must not claim persisted audit records unless an audit store exists.

## 8. Error and Empty States
The user-facing system distinguishes:

- `loading`: identity state is being resolved.
- `unauthenticated`: sign-in is available only if configured.
- `unconfigured`: provider/runtime setup is missing.
- `denied`: authenticated session lacks required scope/module/permission.
- `expired`: treated as unauthenticated after session validation.
- `authorized`: Voice Studio route can render.

This prevents production UI from conflating infrastructure setup, authentication failure, and authorization failure.

## 9. Files and Boundaries
Expected implementation units:

- `packages/core/src/identity.ts` — identity/session/module/permission contracts.
- `packages/core/src/authorization.ts` — generic access checks.
- `packages/core/src/navigation.ts` — safe internal return-path validation.
- `packages/core/src/index.ts` — public exports and compatibility with existing accounting consumers.
- `apps/web/src/identity/AtlasIdentityContext.tsx` — provider-neutral React identity state.
- `apps/web/src/identity/ProtectedRoute.tsx` — guarded route component.
- `apps/web/src/modules/identity/IdentityPage.tsx` — Identity experience.
- `apps/web/src/modules/studio/voice/VoiceStudioPage.tsx` — Voice Studio shell and truthful runtime state.
- `apps/web/src/App.tsx` — route wiring only; no identity business logic embedded here.
- `vercel.json` — SPA rewrites for Identity and Studio routes.
- `tests/unit/identity.test.ts` — permission, module, expiration, and safe-return-path tests.
- `tests/integration/identity-voice-routes.test.tsx` — route and redirect contracts.

## 10. Compatibility
Existing Accounting permission strings remain valid. Existing Finance and Health routes continue to function. The migration changes `AccountingPermission` into or aliases it to the broader `AtlasPermission` contract so current consumers do not break unnecessarily.

No unrelated redesign of Finance, Health, or the global shell is part of this milestone.

## 11. Verification Gates
Before merge or production deployment:

1. `npm ci`
2. `npm run test:unit`
3. `npm run test:integration`
4. `npm run typecheck`
5. `npm run build`
6. Dependency audit gate required by the existing Security/Reliability consensus job.
7. ATLAS Product/UX, Architecture/Build, and Security/Reliability consensus must all succeed.
8. Manual route checks:
   - `/identity?app=/studio/voice`
   - `/studio/voice`
   - unauthenticated redirect
   - authenticated but unauthorized denial
   - provider-unconfigured state
   - unsafe external `app` value rejection
   - Finance and Health regression routes

## 12. Production Readiness Boundary
This milestone can make routing, identity contracts, authorization logic, and Voice Studio structure production-ready. Actual user login is not considered production-ready until a real authorized identity provider is configured and verified in the deployment environment.

Actual voice interaction is not considered production-ready until a real authorized voice runtime/provider is configured, permissioned, tested, and observed through truthful runtime state.

The implementation must stop at these boundaries rather than simulate success.
