# ATLAS Ride — passenger trip preparation checkpoint

Scope: first passenger-facing trip preparation flow inspired by the supplied Waymo reference. This is not a Waymo integration or an autonomous-driving implementation.

Base: `main` at `6f7bc8bf7ccb4c50afb347281c934b4cf1925786`.
Route: `/ride/trip`, inside the existing `RequireAtlasIdentity` and `AtlasShell` boundary.

## Implemented in source

- Origin, destination and up to four intermediate stops, using address search rather than requiring manual coordinates.
- Explicit selection of validated search results; editing a place invalidates the previous selection and summary.
- Ordered, authenticated route-leg queries; distance and estimated driving duration are displayed only after every leg succeeds.
- Loading, empty, failed-search, failed-route and retry states. Old search responses are ignored after edits or unmount.
- Clear-trip action, removable stops, navigation from Ride home and subnavigation.
- Destination-only handoff to the existing GPS query contract. The interface explicitly states that stops and origin are not transferred.
- Responsive CSS, associated labels, keyboard search, status announcements and touch-sized controls.
- No persistent passenger trip records or changes to tenant schemas. Place data stays in component memory; GPS queries use the existing organization-aware API and its existing providers.

Reuse: `searchGpsPlaces`, `calculateGpsRoute`, `validateRidePoints`, GPS distance/duration formatting, existing Ride styling/navigation, identity and organization boundaries. No dependency or provider added.

## Validation

- TDD: the new page test initially failed because the page did not exist, then passed after implementation.
- Nine passenger interaction cases cover selection requirements, ordered legs and totals, invalidation, bounded/removable stops, clearing, empty/error search, stale search responses, retry, later-leg failure and invalid numeric route values.
- `npx vitest run tests/unit tests/integration`: 528 files, 2,517 tests passed.
- `node --test tests/node/*.test.mjs tools/local-agent/tests/*.test.mjs`: 21 tests passed.
- `npm run typecheck`: passed.
- `npm run build`: passed; Vite reports the existing large-bundle advisory.
- `npm run verify:design` and `npm run verify:navigation`: passed.
- `git diff --check`: passed.

The original `npm test` incorrectly collected four Node-native test files with Vitest, reporting “No test suite found”. Its command now runs the existing Vitest unit/integration trees followed by the four files with Node's native runner. No test suite was removed or weakened.

## Release boundaries

Local interaction tests mock the GPS responses. They prove UI behavior, not current provider availability. No authenticated live-provider E2E, browser layout verification, merge, production deploy or production exact-SHA verification is certified by this checkpoint.

Reservation, dispatch, pricing, vehicle unlock, vehicle controls, payment and Waymo connectivity remain unavailable. They require actual provider contracts and verified runtime capability. The screen offers no booking or payment action and does not fabricate a vehicle, quote or dispatch confirmation.

Continue through the canonical PR/CI and Cloudflare release process. Production completion requires the existing P0 verifier and exact deployed SHA evidence; a passing build or this checkpoint alone is insufficient.
