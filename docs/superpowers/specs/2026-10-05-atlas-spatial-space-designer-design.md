# ATLAS Spatial — Space Designer Design

Date: 2026-10-05
Status: design approved in conversation; implementation not started

## 1. Product intent

ATLAS Spatial turns a real physical space into an evidence-aware digital twin that can be redesigned and explored before physical changes are made. The first product reference is the outdoor gazebo/off-site office concept: capture the real space, reconstruct its geometry, apply the ATLAS office design, and let the user walk through the result with first-person navigation and free 360-degree look.

Success means the experience behaves like a spatial product rather than a moving 2D image: furniture and structural elements retain world positions, perspective changes as the camera moves, collision prevents walking through geometry, and Original/Design comparison preserves the same camera pose.

## 2. Truth boundary

ATLAS Spatial must never label a 2D render, zoom/pan effect, generated image, or unverified reconstruction as a verified digital twin.

Every project exposes a reconstruction state:

- `reference_only`: photos/video are available, but no navigable geometry is verified.
- `reconstructed`: navigable geometry exists, with provenance and reconstruction metadata.
- `verified`: dimensions/anchors have passed the configured verification gate.
- `design_simulation`: proposed design objects are overlaid on a reconstructed or verified base and are explicitly simulated.

Generated furnishings and proposed layouts remain `design_simulation` until separately realized/verified. Existing Urban Twin evidence semantics remain canonical.

## 3. Architectural position

ATLAS Spatial is a user-facing spatial-design module, not a second digital-twin backend.

It reuses:

- Urban Twin Core for canonical site/building/floor/space/asset hierarchy and evidence state.
- CleanScan 3D as the capture/reconstruction adapter boundary.
- GPS 4D for geographic positioning and outdoor/indoor navigation handoff.
- ATLAS Work for tasks, implementation work orders, inspections, and field execution.
- Device OS / Device DNA for scanner, sensor, edge-device, and future spatial-compute bindings.
- ATLAS Drive/Creator Library for source captures, derived assets, design versions, and exports where those services are available.

The primary web route is `/spatial`; project routes are `/spatial/projects/:projectId`. Urban Twin remains accessible at its canonical city/twin route and is not duplicated.

## 4. User experience

### 4.1 Project workspace

The workspace has five persistent modes:

1. Capture — source photos/video/LiDAR, coverage, quality, provenance, and reconstruction status.
2. Twin — reconstructed/verified geometry with evidence overlays.
3. Design — proposed furniture, lighting, vegetation, surfaces, zones, and annotations.
4. Walk — first-person navigation with keyboard/touch controls and free-look.
5. Compare — Original vs Design using the same camera pose, with split/hold-to-compare controls.

The first gazebo project defines five design zones: Work, Meet, Lounge, Bar, and Present.

### 4.2 Walk mode

Desktop controls: WASD and arrow movement, pointer drag/mouse look, optional click-to-move, and Escape to release pointer capture when used.

Touch controls: left movement pad plus drag-to-look; tap targets meet mobile accessibility sizing. A reduced-motion mode disables camera easing and nonessential animation.

Navigation is geometry-based. The camera has a configurable human eye height, collision capsule, walkable-surface constraint, and bounded movement. The user cannot walk through columns, counters, desks, walls, or other colliders.

### 4.3 Original / Design comparison

The comparison system stores a single camera pose and renders two scene states:

- Original: reconstructed source geometry/materials only.
- Design: same base plus simulated design layer.

Changing modes must not move the camera. If the original source is only `reference_only`, the UI disables geometry-based comparison and explains why.

## 5. Spatial rendering architecture

The web renderer uses a dedicated scene adapter so rendering technology is replaceable. Initial implementation should use the project's existing web stack plus a browser 3D renderer compatible with glTF/GLB assets. Three.js via React Three Fiber is preferred if it fits the current dependency policy; raw Three.js is the fallback if introducing React Three Fiber would create unnecessary coupling.

Core boundaries:

- `SpatialScene`: owns scene lifecycle and renderer integration.
- `SpatialCameraController`: first-person movement, look, touch controls, reduced-motion behavior.
- `SpatialCollisionWorld`: walkable surfaces and collision queries.
- `SpatialProjectRepository`: project metadata, source captures, reconstruction/design versions, and evidence state.
- `SpatialLayerController`: toggles original, design, evidence, measurement, and annotation layers.
- `SpatialCompareController`: preserves camera pose across Original/Design states.
- `SpatialZonePanel`: Work/Meet/Lounge/Bar/Present navigation and metadata.

No component may infer verification from the presence of a model file.

## 6. Capture and reconstruction pipeline

Pipeline:

`Capture -> ingest -> source validation -> frame/scan processing -> camera/depth estimation -> geometry reconstruction -> scale/anchor calibration -> optimization -> evidence registration -> design overlay -> walk/compare`

Accepted capture classes:

- ordinary photo set;
- continuous phone video;
- 360/equirectangular panoramas;
- LiDAR/depth capture;
- future CleanScan 3D native capture.

The system records capture type, source asset identifiers, timestamps when available, reconstruction engine/version, scale source, confidence/quality metadata, and verification state.

A phone video may produce a reconstructed model when the processing pipeline can do so, but upload alone never changes state beyond `reference_only`.

## 7. Data model

Spatial data extends Urban Twin references rather than replacing them.

`spatial_projects`
- id, organization_id, urban_twin_entity_id, name, status, created_by, created_at, updated_at

`spatial_captures`
- id, project_id, source_kind, asset_ref, captured_at, metadata, provenance, created_by

`spatial_reconstructions`
- id, project_id, capture_set_hash, engine, engine_version, model_asset_ref, nav_asset_ref, scale_source, quality_metadata, verification_state, created_at

`spatial_design_versions`
- id, project_id, base_reconstruction_id, version, status, scene_asset_ref, created_by, created_at

`spatial_design_objects`
- id, design_version_id, zone, object_kind, transform, dimensions, asset_ref, simulation_metadata

`spatial_camera_bookmarks`
- id, project_id, design_version_id, name, position, rotation, created_by

All organization-scoped records require RLS. Audit events are emitted for uploads, reconstruction state changes, verification changes, design publication, and destructive operations.

## 8. Permissions

Minimum RBAC roles/capabilities:

- Viewer: view permitted projects and Walk/Compare.
- Designer: create/edit design versions and bookmarks.
- Surveyor/Verifier: submit calibration evidence and change reconstruction verification state through governed operations.
- Project Admin: manage project membership, captures, versions, and publication.

Verification is never granted by the Designer capability alone.

## 9. Asset reuse and cost control

Before generating new visual or 3D assets, ATLAS checks project/library assets for a valid reusable object/material. Generated assets record provider/model provenance and remain simulated.

The gazebo reference design should reuse the already-approved visual language: warm 2700–3000K lighting, neutral outdoor furniture, natural wood, vegetation, collaborative table, lounge, bar/work counter, presentation display, and clear circulation.

## 10. Performance

Initial targets for the web experience:

- progressive scene loading with visible status;
- optimized GLB/glTF delivery and texture compression where supported;
- bounded texture/model budgets by device class;
- lazy loading of non-visible design assets;
- graceful low-fidelity fallback rather than browser failure;
- no claim that a fallback image is interactive geometry.

Mobile remains a first-class target.

## 11. Failure states

The UI must explicitly represent:

- capture upload failure;
- unsupported/invalid capture;
- reconstruction pending/failed;
- missing scale calibration;
- model unavailable;
- WebGL/renderer unavailable;
- design asset failure;
- permission denied;
- stale reconstruction vs newer capture set.

Failures do not silently fall back to a misleading "digital twin" view.

## 12. Security and privacy

- Organization isolation and RLS are mandatory.
- Source media is private by default.
- Signed/authorized asset access is used for non-public captures and models.
- Uploads are validated by type/size and processed server-side or by an approved processing service.
- EXIF/location metadata is not exposed publicly by default.
- Audit trails cover access-sensitive mutations and verification transitions.

## 13. Testing strategy

TDD is required for implementation.

Unit tests:
- reconstruction-state truth rules;
- compare camera-pose preservation;
- movement bounds/collision adapter behavior;
- RBAC capability checks;
- zone and layer state reducers.

Integration tests:
- `/spatial` and project route wiring;
- project repository + RLS-backed API behavior;
- Urban Twin entity binding;
- capture -> reconstruction-state transitions;
- design version creation/publication;
- Original/Design state synchronization.

Browser/E2E tests:
- keyboard and touch navigation;
- collision with representative gazebo columns/furniture;
- Before/After without camera jump;
- mobile layout;
- reduced motion;
- failure-state honesty when geometry is absent.

Production verification:
- P0: public app shell and health endpoint must satisfy the existing ATLAS fail-closed production policy.
- P0: `/spatial` loads without uncaught runtime errors.
- P1 until a public demo project exists: project-specific sample route checks.

## 14. Delivery slices

Slice 1 — Spatial shell and truth model: route, project repository contract, evidence states, empty/error/loading UX, Urban Twin handoff.

Slice 2 — Geometry viewer and Walk mode: glTF scene, camera controller, collision world, desktop/touch controls, bookmarks.

Slice 3 — Design and Compare: design layer, five gazebo zones, Original/Design synchronized camera, design versions.

Slice 4 — Capture/reconstruction integration: source ingest, reconstruction adapter contract, provenance, calibration/verification gates.

Slice 5 — Production hardening: RBAC/RLS, audit, performance budgets, accessibility, E2E, CI, deployment and fail-closed verification.

Each slice must be independently testable and must not present future slices as already operational.

## 15. Non-goals for first release

- Building a proprietary photogrammetry engine from scratch.
- Claiming centimeter accuracy from ordinary phone video.
- Multi-user real-time editing.
- VR headset support.
- Automatic physical procurement/construction.

These can be added behind stable interfaces later.

## 16. Acceptance criteria

ATLAS Spatial is acceptable when:

1. `/spatial` is a real ATLAS module integrated with existing navigation and permissions.
2. A project can distinguish reference media, reconstructed geometry, verified geometry, and design simulation.
3. A valid 3D project supports first-person movement, free look, collision, desktop and touch controls.
4. Original/Design comparison preserves camera pose.
5. The gazebo reference project can represent Work, Meet, Lounge, Bar, and Present as design zones without falsely claiming the generated concept is measured reality.
6. Urban Twin remains the canonical evidence hierarchy and CleanScan/GPS/Work/Device OS are reused through explicit handoffs.
7. Automated tests cover truth boundaries, navigation state, compare behavior, route integration, permissions, and representative E2E flows.
8. CI and production verification pass under the existing ATLAS fail-closed policy before the feature is described as deployed.
