# ATLAS Portals Design

Date: 2026-09-18  
Status: Implemented on feature branch for verification  
Repository: `atlasenterprisesuite/atlasenterprisesuite`  
Branch: `feat/atlas-portals`

## Objective

Add a futuristic portal-based navigation experience to ATLAS without creating a parallel application, route source of truth, identity system, or fabricated integration state.

## Architecture

ATLAS Portals is an extension of ATLAS Galaxy.

- Protected route: `/galaxy/portals`
- Existing shell: `AtlasShell`
- Existing guard: `RequireAtlasIdentity`
- Canonical destinations: `ATLAS_MODULES`
- Internal navigation: React Router
- Visual implementation: React + CSS, no new rendering dependency
- Progressive spatial capability: browser 3D always; WebXR capability is reported only when a secure browser exposes `immersive-ar`

The feature does not claim to provide physical portals or an active AR session.

## Truthful state rules

- `implemented` -> active portal
- `partial` -> partial portal
- `external-gated` -> external connection required
- authenticated module without resolved identity -> blocked / non-navigable
- Galaxy itself is excluded to prevent recursive self-navigation

No fabricated uptime, balances, approval counts, security claims, connected-provider states, or other production-looking telemetry are permitted.

## UX

The interface includes:

- holographic CSS portal treatment;
- registry-backed destination list;
- search;
- area filters;
- selected destination detail;
- explicit readiness text;
- functional Enter action;
- mobile layout;
- keyboard focus;
- reduced-motion fallback;
- Galaxy launcher;
- ATLAS Voice target for `portal`, `portals`, and `portales`.

## Security

The portal surface cannot upgrade permissions. It only navigates to existing registered routes. Existing identity, tenant, RBAC, provider, and external authorization boundaries remain authoritative at each destination.

## Verification

Required before merge:

1. `npm run typecheck`
2. `npm run test:unit`
3. `npm run test:integration`
4. `npm run build`
5. repository CI checks
6. production route verification after deployment
