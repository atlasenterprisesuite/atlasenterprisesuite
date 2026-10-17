# ATLAS BioScan + Human Digital Twin — Design Specification

Date: 2026-10-05  
Status: Approved design, awaiting written-spec review  
Repository: `atlasenterprisesuite/atlasenterprisesuite`  
Branch: `spec/atlas-bioscan-human-digital-twin-2026-10-05`

## 1. Purpose

ATLAS BioScan turns the approved futuristic body-scan concept into a real, auditable ATLAS capability. It combines CleanScan 3D capture, a persistent Human Digital Twin, Health OS context, Fitness progress, authorized sensor data, Device DNA, ATLAS AI explanation, and Security controls without duplicating existing platform responsibilities.

The target experience is a live spatial interface around the human body: scan progress, geometry, measurements, provenance, posture observations, progress comparisons, and authorized vitals. Every displayed value must be traceable to a real source or clearly labeled as an estimate.

Primary visual references are the user-provided futuristic body-scan concept and the ATLAS Enterprise Suite blue/silver spatial identity. The implementation must reconstruct these concepts as responsive product UI rather than static imagery.

## 2. Core Product Principle

ATLAS BioScan follows one mandatory evidence rule:

> NO DATA → NO CLAIM

ATLAS must never fabricate BPM, temperature, body-fat percentage, muscle mass, medical status, or any other measurement. Each metric must expose its provenance and confidence.

Allowed provenance classes:

- `camera_estimate`
- `depth_sensor`
- `lidar_measurement`
- `wearable`
- `smart_scale`
- `clinical_device`
- `medical_record`
- `user_entered`
- `derived_from_verified_sources`

When no trustworthy measurement exists, the UI must show `Not measured`, `Unavailable`, or an explicitly qualified estimate.

## 3. Scope

This specification defines:

1. BioScan capture sessions.
2. Human Digital Twin persistence and versioning.
3. Body geometry and landmark storage.
4. Measurement and provenance contracts.
5. Posture and symmetry observations.
6. Fitness/physique progress views.
7. Ghost Compare historical overlays.
8. Muscle Map interaction.
9. Scan Replay.
10. Sensor Fusion with authorized devices and records.
11. ATLAS Mirror spatial presentation.
12. Privacy, consent, RBAC, audit, deletion, and retention requirements.
13. Responsive desktop/tablet/mobile routes.
14. Integration boundaries with CleanScan 3D, Health OS, Fitness, Device DNA, Security, and ATLAS AI.

This specification does not authorize unsupported medical diagnosis, fabricated device integrations, hidden biometric identification, or clinical claims from camera imagery alone.

## 4. Architectural Position

BioScan is not a replacement for CleanScan 3D or Health OS.

Responsibility boundaries:

- **CleanScan 3D**: capture orchestration, spatial reconstruction, depth/LiDAR/camera adapters, geometric evidence.
- **ATLAS BioScan**: human-body-specific session model, body landmarks, geometry normalization, provenance-aware measurements, scan UX.
- **Human Digital Twin**: persistent personal body model and historical snapshots.
- **Health OS**: health context, connected records, medical/wellness data, health-specific authorization and interpretation boundaries.
- **Fitness**: progress, training-oriented body measurements, muscle map, trend visualization.
- **Device DNA**: trusted device identity, sensor capability, runtime trust, local/edge device participation.
- **ATLAS AI**: explanation, comparison, summarization, anomaly narration, never a source of fabricated measurement.
- **Security**: consent, tenancy, RBAC, encryption, audit, retention, deletion, export, and policy enforcement.

Canonical flow:

`Camera / Depth / LiDAR / Wearable / Scale / Clinical Device`
→ `CleanScan Capture Engine`
→ `ATLAS BioScan Session`
→ `Human Digital Twin Snapshot`
→ `Health OS / Fitness / ATLAS AI`
→ `Evidence + Audit + History`

## 5. Product Routes

Primary routes:

- `/health/bioscan`
- `/health/body-twin`
- `/health/body-twin/progress`
- `/health/posture`
- `/health/physique`
- `/cleanscan/human`

Secondary entry points:

- Health OS → BioScan
- CleanScan 3D → Human Scan
- Fitness → Body Twin
- Profile → My Body Timeline
- Device OS / Device DNA → Authorized Sensors

All routes must use real navigation and route-state semantics. No placeholder anchors, fake alerts, or non-functional controls are permitted.

## 6. Core Domain Model

### 6.1 `bioscan_sessions`

Represents one capture attempt.

Required fields:

- `id`
- `tenant_id`
- `subject_user_id`
- `started_at`
- `completed_at`
- `status`
- `capture_mode`
- `device_id`
- `consent_record_id`
- `quality_score`
- `coverage_score`
- `failure_reason`
- `created_by`
- `created_at`

Allowed status values:

- `preparing`
- `capturing`
- `processing`
- `complete`
- `partial`
- `failed`
- `cancelled`

### 6.2 `human_twin_snapshots`

Immutable body-state snapshot derived from one successful or partial BioScan session.

Required fields:

- `id`
- `tenant_id`
- `subject_user_id`
- `bioscan_session_id`
- `captured_at`
- `geometry_version`
- `coordinate_system`
- `mesh_ref`
- `confidence_summary`
- `source_summary`
- `created_at`

Snapshots are immutable. New scans create new snapshots rather than overwriting historical data.

### 6.3 `body_landmarks`

Stores normalized anatomical/spatial landmarks used for geometric analysis.

Examples:

- shoulders
- elbows
- wrists
- hips
- knees
- ankles
- head center
- torso centerline
- foot contact points

Each landmark must include:

- 2D/3D coordinate when available
- confidence
- source sensor
- capture timestamp

### 6.4 `body_measurements`

Examples:

- height
- shoulder width
- chest circumference estimate
- waist circumference estimate
- hip circumference estimate
- arm length
- inseam estimate
- left/right limb comparison
- body mass when supplied by a trusted source

Required provenance fields:

- `metric_key`
- `value`
- `unit`
- `source_type`
- `source_ref`
- `confidence`
- `measured_at`
- `is_estimate`
- `method_version`

### 6.5 `sensor_observations`

Stores authorized external measurements such as heart rate, temperature, weight, or activity metrics.

Each observation must retain source/device identity and timestamps. BioScan may display these observations but must not reclassify them as camera-derived values.

### 6.6 `posture_observations`

Geometric observations only, including:

- shoulder-line tilt
- pelvic tilt
- left/right asymmetry
- head-forward angle estimate
- knee alignment observation
- stance symmetry

The system must distinguish geometric observations from medical diagnosis.

## 7. BioScan Capture Experience

### 7.1 Pre-scan

The user sees:

- active capture mode
- device/sensor readiness
- consent state
- privacy notice
- environmental guidance
- expected scan duration
- sensor availability

The scan cannot begin until required consent and device permissions are valid.

### 7.2 Capture

The live experience may show:

- body silhouette
- body landmark overlay
- scan ring or floor target
- coverage progress
- quality/confidence indicator
- directional guidance
- missing-region prompts

Example states:

- `Move slightly left`
- `Turn 90°`
- `Step back`
- `Lighting too low`
- `Depth sensor unavailable — camera-only estimate mode`

### 7.3 Processing

The UI shows real processing stages:

- frame validation
- landmark extraction
- depth fusion when available
- geometry reconstruction
- measurement derivation
- provenance attachment
- snapshot persistence

No false `100%` state may display before completion is verified.

### 7.4 Completion

The completed view exposes:

- overall scan quality
- captured regions
- unresolved regions
- measurement summary
- source/provenance labels
- comparison with previous snapshot when available
- links to Posture, Physique, Body Twin, and Replay

## 8. Human Digital Twin

The Human Digital Twin is a historical model, not a single mutable avatar.

Capabilities:

- 360° rotation
- zoom
- region selection
- timestamp selection
- snapshot comparison
- confidence overlay
- source overlay
- mesh/landmark visibility controls
- privacy-safe export where authorized

The default presentation must not imply medical certainty from geometric capture alone.

## 9. Ghost Compare

Ghost Compare overlays two approved snapshots:

- current vs previous
- current vs selected historical date
- side-by-side mode
- semitransparent overlay mode
- measurement delta mode

The UI must show both timestamps and quality/confidence metadata so users do not compare low-quality and high-quality captures without context.

## 10. Posture Mode

Views:

- front
- side
- rear

Visual guides may include:

- shoulder line
- pelvic line
- body centerline
- knee alignment guides
- ankle/foot stance references

Language must remain observational unless supported by an authorized health source. Example:

Preferred: `Right shoulder appears 2.1° higher in this scan.`

Not allowed from image geometry alone: `You have a spinal disorder.`

## 11. Physique + Muscle Map

Muscle Map provides selectable body regions and connects them to:

- geometric measurements
- fitness history
- training logs where available
- historical deltas
- symmetry observations

Example regions:

- shoulders
- chest
- back
- biceps
- triceps
- forearms
- abdomen
- glutes
- quadriceps
- hamstrings
- calves

This is a visualization and fitness-progress layer, not a mechanism for inferring unmeasured muscle mass.

## 12. Scan Replay

Replay reconstructs the capture session timeline with:

- captured viewpoints
- body landmark confidence
- missing regions
- sensor state changes
- processing milestones
- final accepted/rejected frames

Replay must not expose raw private imagery to unauthorized roles.

## 13. Sensor Fusion

BioScan may combine geometry with authorized external observations.

Examples:

- heart rate from wearable
- body weight from smart scale
- temperature from compatible sensor
- activity/sleep from Health OS-connected sources
- clinically recorded measurements from Health OS

Rules:

1. Original source remains canonical.
2. BioScan stores references or normalized observations, not fabricated replacements.
3. Conflicting values remain visible with timestamps and source labels.
4. ATLAS AI may explain discrepancies but may not silently choose a value without policy support.

## 14. ATLAS Mirror

ATLAS Mirror is the spatial presentation mode inspired by the approved body-scan visual.

Supported presentation targets may include:

- phone
- tablet
- desktop camera
- future ATLAS Vision/Halo surfaces
- smart display or mirror-class hardware when available

UI elements may track the body spatially:

- scan progress
- measurement cards
- authorized vitals
- posture guides
- progress delta
- source confidence

The implementation must degrade gracefully to conventional responsive UI when spatial tracking is unavailable.

## 15. Privacy, Security, and Consent

Body geometry and health-linked observations are sensitive data and require stricter controls than ordinary media.

Mandatory controls:

- tenant isolation
- subject-scoped authorization
- RBAC
- explicit scan consent
- explicit sensor/data-source consent
- encryption in transit and at rest
- audit events for read/export/delete actions
- configurable retention
- user deletion request handling
- user export handling
- raw-image minimization
- immutable provenance metadata
- no biometric identity matching unless separately specified and approved

Raw capture frames should be discarded after derivation when product requirements do not require retention. If retained, retention reason and duration must be explicit and policy-controlled.

## 16. Audit Events

Minimum audit events:

- `bioscan.session.started`
- `bioscan.session.completed`
- `bioscan.session.failed`
- `bioscan.snapshot.created`
- `bioscan.snapshot.viewed`
- `bioscan.measurement.viewed`
- `bioscan.data.exported`
- `bioscan.data.deleted`
- `bioscan.sensor.connected`
- `bioscan.consent.granted`
- `bioscan.consent.revoked`

Audit payloads must avoid embedding raw image content.

## 17. Error and Degraded States

The system must implement explicit UI states for:

- no camera permission
- no supported depth sensor
- low lighting
- insufficient body coverage
- subject partially outside frame
- device trust failure
- network unavailable
- backend unavailable
- consent missing
- unsupported sensor
- stale wearable observation
- geometry processing failure
- snapshot persistence failure

Fail-closed behavior applies to permission, consent, authorization, and provenance integrity failures.

A missing optional sensor must degrade functionality rather than falsely blocking camera-only capture.

## 18. Offline / Edge Behavior

Where Device DNA and platform policy permit, capture may execute locally/at the edge.

Rules:

- consent must be resolved before local capture
- local data must use protected storage
- pending uploads must retain immutable timestamps and source identity
- server sync must detect duplication
- health-linked values cannot be silently merged during conflict
- offline mode must visibly indicate synchronization state

## 19. ATLAS AI Responsibilities

ATLAS AI may:

- explain measurement changes
- summarize trends
- compare snapshots
- identify low-confidence regions
- explain provenance
- suggest rescanning when data quality is poor
- answer user questions about recorded data

ATLAS AI may not:

- invent measurements
- infer unsupported vital signs from ordinary images
- convert geometric asymmetry into a diagnosis without evidence
- hide conflicting sources
- present estimates as measured facts

## 20. Responsive UX

Desktop:

- 3D body twin dominant canvas
- left navigation/context rail
- right evidence/measurement panel
- timeline and comparison controls

Tablet:

- full-width body canvas
- collapsible measurement drawer
- persistent capture/compare controls

Mobile:

- camera-first scanning mode
- bottom sheet for measurements/provenance
- swipeable historical snapshots
- compact 3D/2D body view

All interactive controls require complete active, hover/focus, loading, error, empty, and disabled states where applicable.

## 21. Visual Identity

The product should inherit the approved ATLAS identity:

- dark navy spatial environment
- silver/white typography
- cyan/blue scan energy
- restrained holographic grids
- high-contrast evidence labels
- day/night adaptability
- geometric ATLAS iconography

Visual effects must never obscure provenance, consent, warnings, or accessibility requirements.

## 22. Accessibility

Required:

- keyboard navigation on desktop
- screen-reader labels
- visible focus states
- non-color-only confidence/error indicators
- reduced-motion support
- scalable text
- caption/label alternatives for 3D overlays
- data-table alternative for measurement history

## 23. API Boundary

The first implementation plan should define versioned application contracts for:

- create session
- update capture state
- complete/fail session
- create immutable snapshot
- read snapshot
- list timeline
- list measurements
- list posture observations
- compare snapshots
- attach sensor observation
- resolve provenance
- export data
- delete subject data per policy

No client may write an unprovenanced measurement directly into the canonical measurement store.

## 24. Testing Strategy

### Unit tests

- provenance validation
- estimate labeling
- status transitions
- confidence bounds
- snapshot immutability
- measurement unit normalization
- consent gating
- RBAC decisions

### Integration tests

- capture session → snapshot
- sensor observation → BioScan display
- Health OS reference resolution
- historical comparison
- deletion/export policy
- offline sync conflict behavior

### UI tests

- camera unavailable
- camera-only mode
- depth-enabled mode
- partial scan
- failed scan
- completed scan
- Ghost Compare
- provenance drill-down
- mobile/tablet/desktop layouts

### Security tests

- tenant isolation
- subject access boundaries
- unauthorized raw-frame access
- consent revocation
- audit emission

### Production verification

P0 verification must confirm:

- route availability for shipped BioScan routes
- authenticated authorization behavior
- no fabricated readiness claims
- valid security headers
- expected API health
- failure states remain fail-closed for auth/consent/provenance violations

## 25. Rollout Sequence

Phase 1 — Foundation:

- schema/contracts
- provenance model
- session state machine
- camera-only capture shell
- immutable snapshot history
- consent/audit

Phase 2 — Human Digital Twin:

- landmark/geometry visualization
- measurements
- timeline
- Ghost Compare
- replay metadata

Phase 3 — Fitness/Posture:

- posture observations
- physique dashboard
- muscle map
- progress deltas

Phase 4 — Sensor Fusion:

- wearable/scale/device observations
- Health OS references
- source conflict presentation

Phase 5 — Spatial Experience:

- ATLAS Mirror
- advanced depth/LiDAR adapters
- future Vision/Halo surfaces

Each phase must pass tests and production gates independently. Later phases cannot be represented as live until their integrations are verified.

## 26. Non-Goals

This specification does not include:

- facial recognition
- biometric login based on body geometry
- diagnosis from photos
- automatic clinical treatment decisions
- unsupported claims of body-fat precision
- fabricated real-time vitals
- medical-device certification claims
- replacement of Health OS
- replacement of CleanScan 3D

## 27. Acceptance Criteria

The implementation is acceptable only when:

1. A user can start and complete a provenance-aware BioScan session.
2. A completed scan creates an immutable Human Digital Twin snapshot.
3. Every measurement exposes source, timestamp, confidence, and estimate state.
4. Unsupported vitals are displayed as unavailable rather than fabricated.
5. Historical snapshots can be compared through Ghost Compare.
6. Posture observations remain geometric and non-diagnostic unless external evidence supports otherwise.
7. Sensor observations preserve their original source identity.
8. Consent, RBAC, tenant isolation, audit, export, and deletion paths are implemented.
9. Desktop, tablet, and mobile experiences are functional.
10. Automated tests cover core state, provenance, security, and UI flows.
11. Production verification checks shipped routes and fails closed on P0 auth/consent/provenance failures.
12. No module duplicates the canonical responsibility of CleanScan 3D, Health OS, Device DNA, Security, or ATLAS AI.

## 28. Implementation Boundary

This document is the approved architectural design only. It intentionally contains no production implementation changes. The next allowed stage is a detailed implementation plan after written-spec review and approval.
