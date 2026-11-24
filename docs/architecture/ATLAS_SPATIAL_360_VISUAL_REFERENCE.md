# ATLAS Spatial 360 — Approved visual direction

Status: DESIGN REFERENCE APPROVED / IMPLEMENTATION P0 NO-GO

## Reference
User-approved visual from the ATLAS Spatial 360 conversation, November 2026: premium futuristic mall interior, cutaway multi-floor isometric architecture, mobile navigation companion, blue-electric holographic accents, green route overlay, panorama preview, floor controls, directory, accessibility and emergency affordances.

The source image is a **conceptual reference**, not evidence of an implemented feature or permission to use third-party brand imagery. The image is not embedded here; obtain its authorized project asset through the approved media pipeline before any UI implementation.

## Acceptance criteria
1. Reuse GPS 4D, Urban Twin Core, IndoorNavigationPanel, panoramaEvidence and the verified indoor-route engine; do not create a competing navigation stack.
2. Responsive and accessible layout for iPhone and desktop, with keyboard support, reduced-motion fallback, high contrast, screen-reader labels and touch targets.
3. Clear switching between map 3D, authorized 360 panorama, indoor directory and floor selection.
4. Real routes require server-verified per-edge evidence, tenant authorization, rights checks, revocation and accessibility constraints; client-side metadata is not authoritative.
5. Unverified imagery, simulated scenes, shop hours, location, distance and ETA must never be labeled live, verified or open.
6. Explicit blocked/empty states when a building, scene or route lacks authorized evidence.
7. Tests: negative cross-tenant, missing/revoked evidence, inaccessible links, broken assets; responsive and Safari/iPhone checks; exact-SHA CI.
8. No merge or deploy while any P0 remains open. Approval of the image is not deployment approval.

## Delivery sequence
- F3.1: Inspect and reuse existing GPS 4D presentation contracts.
- F3.2: Create responsive visual shell with safe synthetic scene data clearly marked DEMO.
- F3.3: Bind verified spatial scene registry and panorama viewer; no hardcoded physical routes.
- F3.4: Accessibility, mobile browser tests, security validation, exact-SHA CI and evidence ledger.

## Known gaps
- No licensed, verified Mall at Millenia indoor panorama or route evidence established.
- Existing client-side evidence checks do not prove backend authorization or image integrity.
- The conceptual image's green route, GPS status, open hours and verification percentage are illustrative.
