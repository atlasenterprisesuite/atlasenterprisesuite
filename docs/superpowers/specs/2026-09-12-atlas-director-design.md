# ATLAS Director — Design Specification

Date: 2026-09-12
Status: Approved design, pending implementation plan
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Target branch: `feat/atlas-director`
Owner module: ATLAS Studio / Creator
Primary route: `/studio/create?type=video`

## 1. Purpose

ATLAS Director upgrades the existing ATLAS Studio Video Lab from a single creative-brief textarea into a governed production-planning workspace that converts a simple creative request into a structured, provider-neutral video production specification.

The feature is inspired by advanced prompt-engineering patterns visible in external video-generation workflows: staged timing, shot-by-shot camera instructions, continuity rules, material and lighting constraints, negative constraints, and explicit output requirements. ATLAS must absorb the underlying production logic without copying another product's interface or becoming dependent on a single provider.

The design preserves the current ATLAS principles:

- reuse the existing Creator Studio architecture;
- do not create a parallel application or duplicate route tree;
- keep ATLAS Identity gating and organization boundaries;
- never represent a provider as connected until configuration is verified;
- never fabricate media, metrics, generation status, or provider readiness;
- preserve auditability and provenance;
- keep provider credentials server-side;
- use Supabase as the primary backend direction for persistence, storage, authorization context, and audit data when the integration exists.

## 2. Scope

This design covers the first production-grade ATLAS Director slice:

1. structured production specification;
2. guided video-production workspace;
3. scene and shot planning;
4. continuity rules and validation;
5. visual-style, camera, motion, audio, and negative-constraint controls;
6. provider-neutral prompt compilation;
7. provider capability and cost/readiness gating;
8. persistence contract and provenance model;
9. RBAC and organization isolation requirements;
10. responsive UX and validation states;
11. test and verification requirements.

This design does not include automatic publication to social platforms, a full nonlinear video editor, frame-by-frame compositing, proprietary model hosting, training of custom foundation models, or automatic use of paid provider credits without an authorized generation action.

## 3. Existing ATLAS Context

ATLAS Studio already exposes:

- `/studio`
- `/studio/create`
- `/studio/library`
- `/studio/providers`
- `/studio/voice`

The current `CreatorWorkspace` supports media tabs for image, video, music, and voice. It validates that a creative brief is present but intentionally stops before generation when no provider is configured. That honesty boundary remains in place and becomes more capable, not weaker.

The Director implementation must extend the current Creator module under `apps/web/src/modules/creator` and must reuse the existing route graph and identity protection.

## 4. Design Goals

### 4.1 User goal

A user should be able to start with a plain-language idea such as:

> Create a 20-second futuristic ATLAS Payroll launch spot with a cinematic transformation sequence, realistic materials, stable subject identity, controlled camera motion, and synchronized sound.

ATLAS Director should then help turn that idea into a structured production rather than requiring the user to manually author a long provider-specific prompt.

### 4.2 System goal

The system should produce one canonical `ProductionSpec` that can be validated, versioned, persisted, audited, and compiled differently for multiple video-generation providers.

### 4.3 Success criteria

The first implementation is successful when:

- the user can navigate the full Director flow inside the existing Video Lab;
- the production state survives step changes without data loss;
- shots and timing can be added, edited, reordered, and removed;
- the continuity validator detects blocking contradictions and warnings;
- the provider compiler can produce deterministic provider-specific prompt payloads from the same neutral production spec;
- provider readiness is truthful;
- unsupported provider settings are visible before submission;
- the UI works on desktop, tablet, and mobile;
- identity and permission boundaries remain intact;
- tests cover validation and compilation logic;
- ATLAS does not spend provider credits merely to validate or plan a production.

## 5. Information Architecture

ATLAS Director remains inside the existing Creator workspace.

Primary navigation:

`ATLAS Studio -> Create -> Video -> ATLAS Director`

The Video workspace contains these ordered production sections:

1. Creative Brief
2. Subject / Entity
3. Environment
4. Stages & Shots
5. Continuity
6. Visual Style
7. Camera & Motion
8. Audio
9. Provider & Cost
10. Review & Generate

Desktop may present these as a persistent step rail or segmented navigation. Tablet may use a compact step rail. Mobile should use a stacked step navigator with a clear current-step label and Back/Next controls.

Users must be able to move backward without losing valid entered data.

## 6. Core Domain Model

### 6.1 ProductionSpec

`ProductionSpec` is the source of truth for one video generation request.

Required fields:

- `id`
- `organizationId`
- `createdByUserId`
- `title`
- `brief`
- `status`
- `durationSeconds`
- `aspectRatio`
- `resolutionPreference`
- `audioEnabled`
- `subjects`
- `environment`
- `scenes`
- `continuityRules`
- `visualStyle`
- `cameraDefaults`
- `motionRules`
- `audioPlan`
- `negativeConstraints`
- `providerPreference`
- `providerOverrides`
- `createdAt`
- `updatedAt`
- `version`

Status values:

- `draft`
- `validating`
- `blocked`
- `ready`
- `submitting`
- `generating`
- `completed`
- `failed`

A status must reflect real state. `generating` cannot be entered until a provider has acknowledged a submitted job.

### 6.2 SubjectSpec

A production may contain one or more subjects, objects, products, vehicles, creatures, or other identifiable entities.

Fields:

- `id`
- `label`
- `description`
- `identityLock`
- `appearanceTraits`
- `materialTraits`
- `allowedTransformations`
- `forbiddenChanges`
- `referenceAssetIds`

`identityLock` means the same subject must remain recognizable across all relevant shots.

### 6.3 EnvironmentSpec

Fields:

- `locationDescription`
- `timeOfDay`
- `lightingEnvironment`
- `weatherOrAtmosphere`
- `backgroundConstraints`
- `referenceAssetIds`

### 6.4 SceneSpec

A production contains one or more scenes. Each scene contains ordered shots.

Fields:

- `id`
- `title`
- `startSecond`
- `endSecond`
- `description`
- `shots`

Scenes may not overlap in invalid ways and their total timing must fit within the production duration.

### 6.5 ShotSpec

Fields:

- `id`
- `order`
- `title`
- `startSecond`
- `endSecond`
- `subjectIds`
- `action`
- `camera`
- `motion`
- `lighting`
- `materials`
- `audioCueIds`
- `transitionIn`
- `transitionOut`
- `continuityNotes`
- `negativeConstraints`

### 6.6 CameraSpec

Fields:

- `framing`
- `angle`
- `position`
- `lens`
- `focalLengthMm`
- `depthOfField`
- `movement`
- `movementSpeed`
- `focusTarget`
- `orientationRule`

The `orientationRule` is explicitly modeled so the validator can detect direction reversals that are not intentional.

### 6.7 VisualStyleSpec

Fields:

- `photorealismLevel`
- `cinematicStyle`
- `textureStyle`
- `colorPalette`
- `contrastStyle`
- `filmLook`
- `grain`
- `halation`
- `surfaceDetail`
- `lightingStyle`

Values should be descriptive rather than tied to a single vendor's vocabulary.

### 6.8 MotionRule

Fields:

- `subjectId`
- `movementDescription`
- `direction`
- `speedProfile`
- `physicality`
- `mustRemainContinuous`

### 6.9 AudioPlan

Fields:

- `musicDescription`
- `ambientSound`
- `soundEffects`
- `dialogue`
- `voiceReferenceAssetIds`
- `syncRules`

### 6.10 NegativeConstraint

Fields:

- `id`
- `scope`
- `value`
- `severity`

Scope values:

- `production`
- `scene`
- `shot`
- `subject`

Severity values:

- `preference`
- `warning`
- `blocking`

Examples:

- no text in frame;
- no subject swap;
- no plastic or waxy skin;
- no unauthorized camera reversal;
- no background replacement;
- no second light source;
- no logo deformation.

## 7. Continuity Contract

The continuity contract is a first-class feature, not a free-text note.

A `ContinuityRule` contains:

- `id`
- `ruleType`
- `subjectId` when applicable
- `description`
- `startShotId`
- `endShotId`
- `severity`

Rule types include:

- `identity`
- `orientation`
- `wardrobe-or-surface`
- `material`
- `lighting`
- `position`
- `camera-axis`
- `motion-direction`
- `damage-or-scar`
- `object-presence`
- `transformation-continuity`
- `custom`

Example: if a subject begins with a visible scratch on a left-side metal plate and the rule spans shots 1-7, the compiler should repeat or reinforce that requirement in provider payloads where needed.

## 8. Continuity Validator

Validation runs locally for deterministic rules and may later support an AI-assisted secondary review. The deterministic validator is required first so correctness does not depend on a model response.

### 8.1 Blocking errors

Examples:

- production duration is less than or equal to zero;
- a shot end time precedes its start time;
- a shot exceeds the production duration;
- required shots overlap in a way the chosen scene structure forbids;
- the same continuity rule simultaneously requires contradictory states;
- a provider-required field is missing at submission time;
- a selected provider cannot support the requested duration and no valid adaptation strategy is selected.

### 8.2 Warnings

Examples:

- a subject is identity-locked but a later shot describes a materially different form without an allowed transformation;
- the camera axis flips without an explicit transition;
- lighting changes abruptly between continuous shots;
- a negative constraint conflicts with a shot description;
- audio is requested but the provider does not support native synchronized audio;
- reference counts exceed provider limits;
- a scene has no explicit subject focus.

### 8.3 Pass conditions

The validator returns:

- overall status;
- issue list;
- issue severity;
- affected section;
- affected shot or rule id;
- remediation suggestion.

The Review step must show the same structured issues and allow navigation directly to the affected step.

## 9. Prompt Compiler Architecture

The compiler has two layers.

### 9.1 Neutral compiler

The neutral compiler serializes `ProductionSpec` into a provider-independent production brief with a stable order:

1. objective;
2. duration/output format;
3. subject identity;
4. environment;
5. scene plan;
6. shot plan;
7. visual style;
8. camera and motion;
9. audio;
10. continuity rules;
11. negative constraints;
12. output restrictions.

This structure should be deterministic for the same production version.

### 9.2 Provider adapter

Each provider adapter receives:

- canonical production spec;
- provider capability descriptor;
- optional authorized provider settings.

It outputs:

- compiled prompt text;
- normalized job parameters;
- unsupported-feature notices;
- adaptation notes;
- estimated cost metadata when available.

Initial adapter identifiers:

- `seedance`
- `veo`
- `kling`
- `wan`
- `minimax`

Adapters must not contain provider credentials.

## 10. Provider Capability Model

A capability descriptor contains:

- provider id;
- display name;
- connection state;
- supported generation modes;
- min/max duration;
- supported aspect ratios;
- supported resolutions;
- audio support;
- image reference support;
- video reference support;
- audio reference support;
- max reference counts;
- start-frame support;
- end-frame support;
- provider-specific notes;
- cost estimator availability;
- last verified timestamp.

Connection state values:

- `unconfigured`
- `configured-unverified`
- `ready`
- `unavailable`
- `insufficient-credit`
- `error`

`ready` must only be used after an authorized readiness check succeeds.

## 11. Provider and Cost Gate

The Provider & Cost step performs a dry-run compatibility evaluation before any generation action.

The user should see:

- selected provider;
- connection/readiness state;
- production compatibility;
- requested settings;
- provider-supported settings;
- any adaptations that would be required;
- estimated credit/cost information when the provider exposes it;
- blockers such as insufficient credit or unconfigured credentials.

ATLAS must not debit or spend credits merely to calculate the plan.

If the provider cannot satisfy the request exactly, ATLAS may offer a non-destructive adaptation, for example:

- reduce 30s to multiple shorter shots;
- lower output resolution;
- disable unsupported native audio;
- switch from element references to image references;
- select a compatible provider.

The user must see the effect before submission.

## 12. UI Design

### 12.1 Desktop

Three-part workspace:

- left: production steps and scene/shot outline;
- center: editable production canvas / storyboard cards;
- right: context-sensitive controls and validation.

The right panel changes depending on the active step. It may show camera fields, continuity rules, provider compatibility, or review issues.

### 12.2 Tablet

Two-column layout:

- main editor;
- collapsible context panel.

Step navigation remains visible in compact form.

### 12.3 Mobile

Single-column workflow:

- sticky current-step header;
- one editor section at a time;
- Back and Next controls;
- shot list as collapsible cards;
- provider compatibility and validation rendered inline.

No important action may depend on hover.

## 13. Functional Controls

All represented controls must work.

Required interactions:

- edit title and brief;
- add subject;
- remove subject;
- add scene;
- remove scene;
- add shot;
- duplicate shot;
- reorder shots;
- edit timing;
- add continuity rule;
- add negative constraint;
- select visual style options;
- edit camera defaults;
- edit per-shot overrides;
- configure audio intent;
- select provider;
- run validation;
- navigate to validation issue;
- review compiled prompt;
- submit only when provider and permission checks pass.

No action may be a console-only placeholder.

## 14. Error and State Handling

Required UI states:

- initial empty draft;
- unsaved changes;
- saving;
- saved;
- validation running;
- validation pass;
- warning;
- blocking error;
- provider unconfigured;
- provider unavailable;
- insufficient credit;
- submission pending;
- provider accepted;
- generating;
- completed;
- failed;

The generation result panel must remain empty until an actual provider result exists.

## 15. Persistence Design

When Supabase persistence is available, the preferred logical tables are:

### `creator_productions`

- `id`
- `organization_id`
- `created_by`
- `title`
- `brief`
- `status`
- `duration_seconds`
- `aspect_ratio`
- `resolution_preference`
- `audio_enabled`
- `production_spec_json`
- `version`
- `created_at`
- `updated_at`

### `creator_generation_jobs`

- `id`
- `organization_id`
- `production_id`
- `requested_by`
- `provider_id`
- `provider_job_id`
- `status`
- `compiled_prompt`
- `normalized_params_json`
- `estimated_cost_json`
- `actual_cost_json`
- `error_code`
- `error_message`
- `created_at`
- `updated_at`

### `creator_assets`

- `id`
- `organization_id`
- `production_id`
- `generation_job_id`
- `storage_path`
- `media_type`
- `provider_id`
- `provider_asset_id`
- `mime_type`
- `width`
- `height`
- `duration_seconds`
- `created_at`

### `creator_audit_events`

- `id`
- `organization_id`
- `actor_user_id`
- `production_id`
- `event_type`
- `event_payload_json`
- `created_at`

The final migration names may adapt to existing repository conventions after implementation inspection, but the semantics above are required.

## 16. Security, Tenancy, and RBAC

All production records, jobs, assets, and audit entries must include organization context.

Suggested permissions:

- `creator.read`
- `creator.write`
- `creator.generate`
- `creator.manage_providers`
- `creator.publish`

Rules:

- users without `creator.write` may not modify production specs;
- users without `creator.generate` may validate and review but may not submit a generation job;
- provider configuration controls require `creator.manage_providers`;
- provider secrets are never returned to the browser;
- submission endpoints must re-check authorization server-side;
- organization ids must not be trusted from arbitrary client input when they can be resolved from session context;
- generation events should be auditable.

## 17. Provider Integration Boundary

The frontend must never call a paid generation provider with secret credentials directly.

The intended flow is:

`Browser -> ATLAS server/backend boundary -> provider adapter -> provider API`

The backend boundary performs:

1. authentication;
2. organization resolution;
3. RBAC check;
4. validation pass confirmation;
5. provider readiness check;
6. prompt compilation or verification;
7. job submission;
8. provider job id persistence;
9. audit event recording.

Provider callbacks or polling may later update job state, but the frontend should consume only ATLAS-owned job state.

## 18. Library and Provenance

Completed assets in Creator Library should surface:

- production title;
- production version;
- provider;
- generation date;
- user;
- organization visibility;
- generation job status;
- compiled prompt version;
- reference asset provenance;
- output metadata.

Library search should operate on real persisted metadata only.

## 19. Accessibility

The Director must preserve ATLAS inclusive communication principles.

Minimum requirements:

- keyboard-accessible step navigation;
- visible focus states;
- semantic labels for all form controls;
- no information conveyed by color alone;
- validation messages associated with affected controls;
- screen-reader-readable shot ordering;
- mobile controls with usable touch targets;
- reduced-motion-safe UI transitions;
- captions/transcript fields when dialogue or spoken audio is part of a production.

## 20. Testing Strategy

### 20.1 Unit tests

Required for:

- timing validation;
- continuity validation;
- negative-constraint conflict detection;
- provider capability matching;
- neutral compiler determinism;
- provider adapter mapping;
- cost/readiness gate state derivation.

### 20.2 Component tests

Required for:

- step navigation;
- state preservation between steps;
- shot add/remove/reorder;
- validation issue navigation;
- disabled Generate button when blocked;
- provider-unconfigured state;
- mobile step flow.

### 20.3 Integration tests

Required for:

- identity-gated access to Director;
- draft -> validate -> ready flow;
- permission rejection for generation without `creator.generate`;
- provider incompatible setting path;
- provider-unconfigured path;
- failed-generation state handling.

### 20.4 Repository validation

Before completion:

- `npm run typecheck`
- `npm test`
- `npm run build`

Affected routes must be verified to avoid 404/500 behavior.

## 21. Implementation Boundaries

### Phase A — local and provider-neutral

Must work without provider credentials or paid credits:

- production state model;
- Director UI;
- scenes and shots;
- continuity rules;
- validator;
- neutral compiler;
- provider capability model;
- dry-run compatibility and cost display;
- review screen;
- tests.

### Phase B — persistence

Connect production drafts, jobs, assets, and audit records to the existing Supabase architecture after inspecting current schemas and auth patterns.

### Phase C — provider submission

Enable real generation only when:

- server-side credential storage exists;
- provider readiness can be verified;
- RBAC is enforced;
- cost/credit conditions are known;
- submission and status reconciliation are implemented;
- production verification passes.

## 22. Files and Module Direction

Exact file names may be refined during implementation planning, but the preferred shape is:

- `apps/web/src/modules/creator/CreatorStudioPage.tsx` — route-level composition only;
- `apps/web/src/modules/creator/director/AtlasDirectorWorkspace.tsx`
- `apps/web/src/modules/creator/director/DirectorSteps.tsx`
- `apps/web/src/modules/creator/director/ShotEditor.tsx`
- `apps/web/src/modules/creator/director/ContinuityPanel.tsx`
- `apps/web/src/modules/creator/director/ProviderGate.tsx`
- `apps/web/src/modules/creator/director/ReviewPanel.tsx`
- `apps/web/src/modules/creator/director/types.ts`
- `apps/web/src/modules/creator/director/validateProduction.ts`
- `apps/web/src/modules/creator/director/compileProduction.ts`
- `apps/web/src/modules/creator/director/providers/`
- focused tests adjacent to or under the repository's existing test conventions.

The implementation should avoid growing `CreatorStudioPage.tsx` into a monolithic file.

## 23. Non-Goals and Explicit Safeguards

The first implementation must not:

- claim OpenArt, Seedance, Veo, Kling, Wan, or MiniMax is connected unless verified;
- spend credits during planning or validation;
- expose API keys in frontend code;
- fabricate sample generation results as if they were real;
- silently alter a user's duration, resolution, audio, or reference requirements;
- bypass RBAC to make a generation request succeed;
- create a second canonical repository;
- create a second Creator Studio application.

## 24. Completion Criteria

ATLAS Director is ready for implementation completion review when:

1. the guided Director experience is available under the existing video route;
2. users can build and edit a valid `ProductionSpec`;
3. continuity validation returns actionable issues;
4. compiled prompts are deterministic and provider-specific;
5. provider compatibility is visible before submission;
6. generation remains blocked when provider readiness is not verified;
7. permissions are respected;
8. responsive states are tested;
9. repository typecheck, tests, and build pass;
10. no secrets or fake provider state are introduced;
11. persistence and provider boundaries are explicit and auditable.

## 25. Recommended Implementation Approach

Use a provider-neutral Director core with adapter-based provider integration.

This approach is preferred over direct OpenArt coupling or one-off provider-specific UI flows because it:

- keeps ATLAS in control of its production model;
- supports multiple providers without duplicating the user experience;
- allows validation and planning without spending credits;
- makes cost and capability comparison possible before generation;
- preserves a clean migration path when providers change;
- supports future orchestration through ATLAS Manager without redesigning Creator Studio.
