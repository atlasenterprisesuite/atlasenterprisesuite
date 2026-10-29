# ATLAS GPS 5D — International Drive Pilot

Status: predeploy / NO-GO. No production claims.

## Pilot anchor
Rosen Inn at Pointe Orlando, 9000 International Drive, Orlando FL 32819.
Pilot scope: bounded surrounding International Drive area, not all of Orlando.

## Reuse first
- apps/web/src/modules/gps/Gps4DPage.tsx
- apps/web/src/modules/gps/immersiveSpatial.ts
- apps/web/src/modules/gps/Photorealistic3DView.tsx
- apps/web/src/modules/gps/navigationEngine.ts
- supabase/functions/atlas-gps/index.ts
- docs/superpowers/specs/2026-09-25-atlas-gps-4d-immersive-buildings.md

## Acceptance gates
1. Inventory street addresses/building entrances with source, timestamp, precision, license and confidence; unverified entries must be labeled.
2. Collect licensed images with attribution and per-asset provenance; do not scrape or redistribute restricted imagery.
3. Display georeferenced building footprints and optional authorized panoramic/3D assets; never mislabel reference photos as 3D scans.
4. Resolve accessible pedestrian/cycle/driving routes only with verified graph edges and provider status.
5. Require building-specific indoor data and organization membership before entering indoor mode; enforce RLS and revocation.
6. Add negative TDD for missing imagery, revoked access, cross-tenant asset access, invalid coordinates, bad attribution, and unavailable routing providers.
7. Validate on isolated test environment, exact-SHA CI, accessibility/mobile performance, then production gates separately.

## Safety and cost
No API keys, provider purchases, paid calls, production SQL, merge or deploy authorized by this pilot. Fail closed on unverified source, licensing, access or provider readiness.

## Evidence checkpoint
Branch based on main 6f7bc8bf7ccb4c50afb347281c934b4cf1925786. Existing spatial provider contracts inspected. No real 5D imagery, complete address inventory, E2E certification or production readiness asserted.
