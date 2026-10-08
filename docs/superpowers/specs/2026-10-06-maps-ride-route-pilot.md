# Optional Maps 3D and independent Ride route pilot

Approved scope: reuse GPS 4D's optional Google Photorealistic 3D layer; add a bounded route-planning pilot inside Ride OS. Google is an optional provider, not ATLAS's source of truth. Canonical web delivery remains Cloudflare.

## Reuse and implementation

- `/gps` already has Google Map Tiles and Cesium 1.105, with Open 3D available independently. Fix premature readiness: wait for `readyPromise`, handle timeout/provider failures, destroy failed viewers and suppress late success after unmount. This proves root tileset readiness, not complete geographic coverage or every visible tile.
- `/ride/routes` uses existing `RideRoutes`, `RequireAtlasIdentity`, subnavigation, GPS API, distance utilities and design tokens.
- One vehicle, fixed origin/destination, at most eight intermediate stops. Local Held–Karp ordering minimizes geodesic distance. It does not optimize road travel, traffic, time windows, capacity or dispatch.
- Road estimates are explicitly requested through the existing authenticated organization-scoped `atlas-gps` route operation. Query each leg in proposed order; reject incomplete/invalid results; preserve the independent plan on failure.
- Export an ATLAS plan or a credential-free Google `OptimizeToursRequest` delivery model. Google export is request preparation, not provider execution. No Google Route Optimization call or billing is activated.
- Editing input clears old results. No production/demo locations are seeded. Points stay in component memory until an explicit route request or export. Downloads are user-controlled; no new storage/table is introduced.

## TDD plan and acceptance

1. Reproduce premature 3D success and missing cleanup with deferred provider fixtures.
2. Validate geometric ordering, bounded inputs, origin/destination preservation and portable Google request mapping.
3. Test real UI interaction, explicit road calls and failure behavior with test-only provider fixtures.
4. Run typecheck, full tests, build, design and edge verification. Use canonical PR/CI and Cloudflare delivery, then verify exact revision and public P0 routes.

## External gates

Google 3D runtime requires the existing authorized Maps configuration, billing, origin/API restrictions and coverage verification. Route Optimization execution requires a Google project, server-side OAuth identity with `routeoptimization.locations.use`, spend controls and an authenticated provider adapter. None is claimed active by this change. Browser/provider secrets must not be added to this PR.

Production verification is fail-closed. An inaccessible public endpoint or unavailable authenticated test session prevents a production-complete claim. A rendered SPA shell alone does not prove an authenticated workflow.

Official references:
- https://developers.google.com/maps/documentation/tile/3d-tiles
- https://developers.google.com/maps/documentation/route-optimization/reference/rest/v1/projects/optimizeTours
