# ATLAS Spatial Interface — Design Specification

Date: 2026-09-12
Status: Approved architecture; awaiting written-spec review before implementation planning
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Branch: `feat/atlas-spatial-interface`

## 1. Objective

Build **ATLAS Spatial Interface** as a governed multimodal interaction layer for ATLAS Enterprise Suite. It converts live hand gestures, optional voice intent, spatial target context, current ATLAS state, user permissions, and module ownership into safe and auditable commands.

The visual reference is treated as a product specification and interaction direction, not as artwork or a prerecorded interface.

The product must support both:

1. **Gesture navigation** — focus, select, open, back, scroll, and switch modules.
2. **Interactive 3D manipulation** — rotate, zoom, grab, move, isolate, and inspect a humanoid/digital-twin or other governed 3D objects.

Spatial input is an additional modality. Keyboard, pointer, touch, voice, and assistive navigation remain valid alternatives.

Primary pipeline:

`Camera / Pointer / Touch / Voice`
→ `Input adapters`
→ `Gesture / Intent interpretation`
→ `Active mode`
→ `Target resolution`
→ `Authorization + risk policy`
→ `Module adapter`
→ `Domain action`
→ `Result`
→ `Audit`

Core rule:

> Presence is not intent. Motion is not authorization. A gesture becomes an ATLAS command only after context, confidence, permissions, and execution policy agree.

## 2. Repository Context and Reuse Strategy

The canonical repository is `atlasenterprisesuite/atlasenterprisesuite`; `main` is canonical. Current ATLAS already has a React/Vite application, npm workspaces, identity/session behavior, modules, tests, and CI/deployment workflows. These must be reused before creating equivalents.

A prior branch, `atlas/spatial-entry-v1`, contains an earlier spatial landing implementation. It is materially diverged from current `main`, so it must not be merged wholesale or treated as current architecture. Useful concepts may be selectively ported only after comparison with current `main` and without overwriting newer ATLAS functionality.

This specification defines the next-generation Spatial Interface and supersedes the narrower Spatial Entry v1 product scope.

## 3. Ownership and Boundaries

Primary owner:

`ATLAS AI Core / ATLAS Voice → ATLAS Spatial Interface`

Secondary integrations:

- ATLAS Automations & Shortcuts
- ATLAS Connect
- ATLAS Security / RBAC / audit
- ATLAS Health / Digital Twin
- future ATLAS modules exposing governed command adapters

Spatial Interface owns camera capability/consent UX, hand-landmark intake, gesture interpretation, spatial cursor/targeting, 3D interaction, multimodal intent composition, command routing, confirmation UX, spatial session state, audit metadata, and fallback behavior.

It does **not** own Payroll, Finance, HR, Health, payment execution, external communication, device protocols, provider credentials, tenant identity, or domain-specific authorization rules. Those remain with their owner modules/services.

## 4. Navigation and Routes

Hierarchy:

`ATLAS Enterprise Suite`
→ `AI Core / Voice`
→ `Spatial Interface`
→ `Spatial Workspace`

Initial routes:

- `/spatial`
- `/spatial/workspace`
- `/spatial/calibration`
- `/spatial/gestures`
- `/spatial/commands`
- `/spatial/digital-twin`
- `/spatial/automations`
- `/spatial/integrations`
- `/spatial/sessions`
- `/spatial/permissions`
- `/spatial/settings`

These routes integrate into the current ATLAS shell and routing conventions. No parallel app shell, `href="#"`, fake connected state, or console-only action is permitted.

## 5. Live Workspace

The Live Workspace is the centerpiece.

**Center:** interactive 3D scene containing the active humanoid, digital twin, ATLAS object, model, or scene.

**Left:** contextual object/navigation tree, such as `Human → Systems → Organs → Structures` or `Enterprise → Finance → Invoice → Record`.

**Right:** context/action panel showing only available information and actions for the selected target. Sensitive authorization is revalidated by the authoritative backend/service.

**Bottom:** spatial command strip showing detected gesture, confidence, active mode, camera state, optional microphone state, pending confirmation, and pause/lock control.

A visible gesture cursor indicates where ATLAS believes the user is pointing.

Required states include camera unavailable, permission denied, no hand detected, low confidence, hand detected, target focused, gesture armed, awaiting confirmation, executing, success, failed, and controls paused.

## 6. Workspace Modes

Three explicit modes exist from v1:

- **Navigate Mode** — menus, tabs, routes, records.
- **Manipulate Mode** — grab, rotate, zoom, move, isolate, inspect 3D objects.
- **Command Mode** — ATLAS actions and automations.

The active mode must always be visible. A gesture must not have ambiguous meaning across modes.

## 7. Vision and Gesture Engine

Camera access requires explicit user action and browser permission. Full camera frames are not stored by default.

Preferred v1 direction is local browser inference when supported, behind an interchangeable provider contract:

`VisionProvider → HandFrame → GestureEngine`

The implementation may use MediaPipe Tasks Vision or an equivalent provider, but application logic must not be hard-coupled to one vendor.

Initial gesture vocabulary:

- Point → focus/spatial cursor
- Pinch → select
- Swipe left/right → navigate
- Open palm → pause/cancel
- Grab + move → move 3D object
- Grab + rotate → rotate object
- Two-hand spread → zoom in
- Two-hand pinch → zoom out
- Hold pinch → arm command
- Confirm gesture → confirm already-armed command

Each recognized event carries confidence, duration, velocity, handedness, target, mode, and stability-window information.

A single video frame is never sufficient to execute a command. Recognition requires temporal stability and context validation.

## 8. 3D Spatial Scene

Use a modular scene engine, with Three.js as the recommended first renderer if it remains compatible with current repository constraints.

Conceptual hierarchy:

`SpatialScene`
→ `Camera`
→ `Lights`
→ `SceneObjects`
→ `InteractionTargets`
→ `SelectionLayer`
→ `TelemetryLayer`

The humanoid is a rendered `SpatialObject`, not a medical record. A future Health Digital Twin may attach governed Health data through an explicit adapter and Health permissions.

No Health data is shown on the default humanoid merely because the model is human-shaped.

## 9. Voice + Gesture Fusion

ATLAS Voice remains optional. Spatial does not create a second voice platform.

Example:

`gestureTarget = invoice_382`
+
`voiceIntent = open`
→ `OPEN_RECORD(invoice_382)`

The multimodal resolver combines:

`Gesture context + Voice intent + Active module + User permissions`
→ `Multimodal intent`
→ `Command router`

If voice is unavailable, gesture, pointer, touch, and keyboard remain functional.

## 10. Safety and Risk Tiers

Mandatory flow:

`Gesture`
→ `Confidence Gate`
→ `Context Gate`
→ `Target Validation`
→ `Permission Guard`
→ `Risk Classification`
→ `Confirmation Policy`
→ `Execution`
→ `Audit`

Risk tiers:

- **Tier 0 — Visual:** rotate, zoom, inspect. Immediate.
- **Tier 1 — Navigation:** open module/tab/record. Immediate when valid.
- **Tier 2 — Reversible:** filters, nonsensitive configuration, draft preparation. Brief confirmation where appropriate.
- **Tier 3 — Sensitive:** financial records, payroll, HR, Health, permissions, external communications. Deliberate confirmation required.
- **Tier 4 — Critical:** payments, payroll approval, permanent deletion, security changes, publication, high-impact external action. Gesture alone can never authorize execution.

Sensitive and critical operations must use the owner module's authorization requirements.

Gesture state machine:

`candidate → armed → confirmed → executed`

Loss of hand tracking, focus, target, confidence, or valid context before confirmation cancels the pending command.

## 11. Privacy

Persistent status indicators must show:

`Camera ON/OFF · Microphone ON/OFF · Spatial Controls ACTIVE/PAUSED`

Privacy Mode must:

- stop camera tracks
- clear transient landmark/gesture state
- cancel pending gestures
- lock spatial execution

Frames and instantaneous landmarks are ephemeral by default. Video recording, if ever introduced, must be a separate explicit feature with visible consent and policy.

## 12. Data Model

### SpatialSession

- session_id
- tenant_id
- user_id
- device_id
- started_at
- ended_at
- camera_permission
- voice_enabled
- active_scene
- status

### GestureDefinition

- gesture_id
- name
- gesture_type
- required_hands
- minimum_confidence
- hold_duration
- allowed_contexts
- enabled

### GestureEvent

- event_id
- session_id
- gesture_id
- confidence
- timestamp
- target_id
- mode
- state

### SpatialCommand

- command_id
- source_gesture
- target_type
- target_id
- action
- required_permission
- confirmation_policy
- status

### SpatialObject

- object_id
- scene_id
- object_type
- label
- transform
- interaction_capabilities
- data_source
- permission_scope

### CommandExecution

- execution_id
- session_id
- command_id
- actor_id
- authorization_result
- executed_at
- result
- error_code
- audit_reference

## 13. Integrations

### ATLAS Voice

Consumes an intent contract; no duplicate voice system.

### Automations & Shortcuts

Spatial invokes existing shortcuts/workflows after tenant, permission, dependency, and risk checks. It does not create a second automation engine.

### ATLAS Connect

Device actions use:

`Spatial Command → ATLAS Connect → Device Adapter → authorized device`

Spatial does not directly own hardware protocols.

### Health / Digital Twin

Health data is an explicit governed layer:

`3D Model + Health Data Adapter + Health permissions + provenance + context`

The renderer is not the source of truth.

## 14. Authorization, Tenancy, and Audit

Real actions require server-authoritative authorization:

`user → organization → tenant → role → permission → resource → action → policy`

Client-side state may improve UX but cannot grant authority.

Audit records should capture at minimum:

- execution_id
- session_id
- tenant_id
- actor_id
- source modality
- gesture_id
- voice_intent_id when present
- target_type
- target_id
- requested_action
- risk_tier
- permission_decision
- confirmation_method
- timestamp
- execution_result
- error_code
- correlation_id

The audit trail must answer: who requested what, on which target, through which modality, with what authorization result, and what actually happened.

## 15. Persistence Classes

**Ephemeral:** camera frames, transient landmarks, cursor position, gesture candidates.

**Configuration:** calibration, gesture preferences, mappings, scene preferences, accessibility settings.

**Governed:** command execution, authorization decisions, sensitive configuration changes, and audit records.

Do not introduce a second database solely for Spatial Interface. Reuse the canonical ATLAS persistence/backend direction when available.

## 16. Package and Code Boundaries

Target logical boundaries:

- `apps/web/src/modules/spatial` — pages, routing, UI, workspace shell
- `packages/spatial/vision` — provider contracts and normalized frames
- `packages/spatial/gestures` — gesture recognition/state machine
- `packages/spatial/scene` — renderer-agnostic object/scene contracts
- `packages/spatial/commands` — intent and command routing
- `packages/spatial/policy` — risk and confirmation policy
- `packages/spatial/integrations` — adapters to Voice, Connect, Automations, Health, and future modules

Avoid a monolithic Spatial component that combines camera, 3D rendering, authorization, routing, and domain calls.

## 17. Progressive Enhancement and Device Degradation

Spatial Interface must detect real device/browser capabilities.

- **Desktop full mode:** camera gesture + 3D + optional voice + commands.
- **Tablet:** touch + 3D; camera gestures when support/performance are sufficient.
- **Mobile:** simplified 3D + touch; camera gestures optional by capability.
- **No camera:** pointer/touch/keyboard remain operational.
- **No microphone:** gesture remains operational.
- **No suitable WebGL:** accessible 2D interface remains operational.

Status may expose `Optimal`, `Reduced`, or `Compatibility Mode` only when those states reflect measured capability.

## 18. Performance

Camera capture, inference, gesture interpretation, and 3D rendering must not be unnecessarily coupled to the same frequency.

Use adaptive inference and rendering. If the device loses performance, reduce inference/scene cost before compromising the stability of the overall ATLAS application.

Scene resources must be disposed cleanly when routes/scenes unmount.

## 19. Accessibility

Every gesture-driven action must have an equivalent reachable through appropriate conventional or assistive input such as keyboard, pointer, touch, voice, or assistive navigation.

Requirements include:

- visible keyboard focus
- semantic DOM controls for meaningful actions
- screen-reader-compatible navigation
- `prefers-reduced-motion` support
- no mandatory hover
- no mandatory gesture
- usable 2D fallback
- support for future ATLAS Inclusive Communication adapters without redesigning the command model

## 20. Testing Strategy

Use current repository test infrastructure and extend it as needed.

### Unit

- gesture classifier
- stability windows
- state-machine transitions
- risk classification
- command mapping
- multimodal resolution

### Integration

`Gesture → Router → Policy → Module Adapter → Audit`

### Component

Camera permission states, confidence states, workspace modes, scene state, confirmation UI, fallbacks.

### Browser/E2E

Permissions, navigation, spatial interactions, 2D fallback, route integration, session lifecycle.

### Security

Authorization bypass attempts, spoofed client commands, tenant isolation, stale target IDs, critical-action confirmation.

### Accessibility

Keyboard-only, reduced motion, screen-reader semantics, noncamera equivalents.

### Performance

Inference latency, dropped-frame handling, memory/scene disposal, device degradation.

CI uses deterministic `FakeVisionProvider` fixtures so hardware cameras are not required for core tests.

## 21. Critical Failure Cases

Before production candidate status, all applicable cases must pass:

- camera rejected → ATLAS remains usable
- hand disappears during confirmation → cancel
- confidence falls below policy → no execution
- duplicate gesture → deduplicate
- user lacks permission → deny
- tenant mismatch → deny
- target no longer exists → no execution
- voice contradicts gesture target/action → resolve explicitly or do not execute
- browser loses focus during pending action → disarm
- camera permission revoked → stop tracks
- Privacy Mode → clear transient state and lock execution
- backend unavailable → visible failure; never false success
- required audit unavailable for governed action → fail closed where policy requires
- payment/delete/security action → gesture alone never sufficient

## 22. Production Readiness Gates

Spatial Interface cannot be called production-ready based on visual fidelity alone.

Required gates:

- architecture boundaries preserved
- typecheck passes
- unit/integration/E2E requirements pass
- production build passes
- Vision permissions/fallback/cancel behavior passes
- Gesture false-positive criteria meet approved threshold
- scene lifecycle shows no critical leaks
- backend authorization enforced
- tenant isolation verified
- Tier 3/4 bypass impossible through gesture-only path
- governed audit trace available
- camera/microphone privacy state verified
- accessible alternatives verified
- responsive desktop/tablet/mobile behavior verified
- disconnected dependencies do not present false live states
- no critical ATLAS regression
- deployment health/logs verified after separate deployment authorization

Lifecycle:

`DESIGN COMPLETE`
→ `IMPLEMENTED`
→ `TESTED`
→ `SECURITY VERIFIED`
→ `PRODUCTION CANDIDATE`
→ `DEPLOYED`
→ `POST-DEPLOY VERIFIED`

Implementation completion does not imply deployment completion.

## 23. Delivery Phases

1. **Foundation** — current-main route integration, contracts, state models, feature boundary.
2. **Vision** — camera permission/calibration, provider contract, normalized landmarks, Gesture Engine.
3. **Spatial 3D** — renderer, humanoid/object scene, selection, grab/rotate/zoom.
4. **Command Governance** — router, risk tiers, permission bridge, confirmation, audit adapter.
5. **Multimodal Integrations** — Voice, Automations, Connect, Health adapters where real contracts exist.
6. **Production Hardening** — accessibility, security, performance, compatibility, regression, observability.

Each phase must use test-first implementation where applicable and must not invent unavailable external integrations.

## 24. Acceptance Criteria

ATLAS Spatial Interface is accepted for implementation completion when:

- it is integrated into current ATLAS navigation without replacing newer modules or identity behavior;
- users can navigate ATLAS and manipulate supported 3D objects through real gestures on capable devices;
- camera, microphone, WebGL, and voice dependencies degrade safely;
- gesture state and confidence are visible rather than hidden;
- sensitive/critical operations cannot bypass owner-module authorization and confirmation policy;
- audit events identify the real actor, tenant, target, modality, decision, and result;
- keyboard/touch/pointer alternatives remain functional;
- automated tests validate core gesture, policy, routing, and fallback behavior;
- build/typecheck/tests pass before merge is proposed;
- no merge or deployment is implied by this specification.

## 25. Explicit Non-Goals for the First Implementation Plan

The first implementation plan must not include:

- autonomous physical robotics control
- medical diagnosis or treatment recommendation
- automatic recording of camera streams
- gesture-only payments or destructive actions
- fake live integrations
- replacement of ATLAS Voice, Connect, Automations, Security, Health, or other module source-of-truth services
- wholesale merge of the stale `atlas/spatial-entry-v1` branch
- production deployment without separate explicit approval and verification gates
