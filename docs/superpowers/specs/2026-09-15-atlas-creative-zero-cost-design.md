# ATLAS Creative Studio — Zero-Cost-First Design Specification

Date: 2026-09-15
Status: Approved design, pending implementation plan
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Target branch: `feat/atlas-creative-zero-cost`
Owner module: ATLAS Studio / Creator
Primary routes: `/studio`, `/studio/create`, `/studio/library`, `/studio/providers`, `/studio/voice`

## 1. Purpose

ATLAS Creative Studio extends the existing Creator Studio into a governed multimedia production system capable of planning, generating, editing, organizing, exporting, and later publishing image, video, music, voice, sound-effect, caption, graphic, template, and branded-media workflows.

The product direction is inspired by the integrated creative workflow category represented by products such as Artlist, but ATLAS must not copy another product's UI, provider contracts, copyrighted assets, or business model. ATLAS owns its workflow, data model, security boundaries, prompt architecture, provider abstraction, storage model, and user experience.

The defining product principle is **zero-cost-first**. ATLAS should prefer capabilities that can operate without a recurring external provider charge when practical, using browser-native features, open-source software, local execution, self-hosted execution, already-authorized infrastructure, and portable prompt export. Paid APIs may be supported as optional adapters, but no paid provider may become a mandatory dependency for the core Creator workflow.

The system must preserve ATLAS's existing truthfulness boundary: no provider is reported as connected until verified, and no media result is reported as generated until a real asset exists and is verified.

## 2. Existing ATLAS Context

ATLAS already contains the core Creator route tree and Identity gate:

- `/studio`
- `/studio/create`
- `/studio/library`
- `/studio/providers`
- `/studio/voice`

The current Creator workspace already supports media modes for image, video, music, and voice. Video routes into ATLAS Director. The current workspace intentionally blocks generation when no compatible provider is configured. Creator Library already reads persisted production and asset records. Provider readiness already exposes verified server-side states.

This design extends those capabilities rather than creating a parallel media application.

The existing permission contract remains authoritative:

- `creator.read`
- `creator.write`
- `creator.generate`
- `creator.manage_providers`
- `creator.publish`
- `creator.admin`

The existing `ProductionSpec`, `CreatorAsset`, provider-readiness concepts, organization scoping, and provenance requirements must be reused or extended compatibly.

## 3. Product Goal

A user should be able to describe one creative objective in natural language and let ATLAS transform it into a structured multimedia production plan.

Canonical flow:

`Idea -> Creative Brief -> Production Plan -> Storyboard -> Shot/Scene Plan -> Specialized Prompts -> Provider Selection -> Generation or Prompt Export -> Asset Verification -> Library -> Composition -> Export -> Optional Publish`

The user should not need to understand provider-specific syntax before starting.

## 4. Zero-Cost-First Operating Policy

ATLAS chooses execution paths in this order:

1. browser-native capability;
2. already-installed local capability;
3. open-source/self-hosted capability already available to the organization;
4. verified free-tier provider with sufficient current quota;
5. already-authorized bring-your-own provider;
6. portable prompt export when generation is unavailable;
7. paid provider only when explicitly configured and authorized.

This is a preference order, not a claim that all generative workloads are free. Heavy image, video, music, or voice generation may require GPU, CPU, storage, bandwidth, or external credits. ATLAS must expose this distinction clearly.

### 4.1 Cost truthfulness

ATLAS must never label a workload `free` merely because the software is open source. The runtime may still consume user-owned compute or hosting resources.

Every execution option should expose a normalized cost class:

- `browser-local`
- `local-compute`
- `self-hosted`
- `free-tier`
- `byo-provider`
- `paid-provider`
- `prompt-export-only`

Optional estimated monetary cost may be shown only when a verified estimator exists.

## 5. Scope

### 5.1 In scope for the first implementation program

- unified Creator home experience;
- multimodal creative brief;
- Prompt Engine;
- Image Lab integration;
- ATLAS Director integration;
- Music Lab planning;
- Voice Studio integration;
- sound-effect planning and asset handling;
- Creator Library expansion;
- provider/motor registry;
- local/free/BYO/prompt-export execution modes;
- provenance and audit data;
- Brand Kit metadata and reusable presets;
- export pipeline for verified assets;
- responsive desktop/tablet/mobile UX;
- truthful empty, unavailable, configured, ready, generation, success, and error states;
- tests for routing, permissions, provider selection, prompt compilation, provenance, and truthful readiness.

### 5.2 Deferred from the first implementation program

- training proprietary foundation models;
- hosting large foundation models by default;
- building a full Adobe Premiere-class nonlinear editor;
- autonomous publication to external social accounts without separate authorization;
- automatic purchasing or charging of provider credits;
- copying commercial stock-media catalogs;
- representing unlicensed third-party stock as ATLAS-owned media.

## 6. Information Architecture

ATLAS retains the current route tree.

### `/studio`

Creator command center. Shows the creative workflow, recent authorized assets, active productions, capability readiness, and clear entry points.

### `/studio/create`

Primary multimodal composer. Initial media kinds:

- `image`
- `video`
- `music`
- `voice`
- `sfx`
- `graphic`
- `template`

Video continues to use ATLAS Director rather than a second video editor.

### `/studio/library`

Searchable Creator Library containing verified generated assets, imported assets, references, exports, production versions, provenance, tags, and visibility.

### `/studio/providers`

Creative engine registry and readiness surface. Shows execution class, capability type, current readiness, verification timestamp, supported media modes, local/server requirements, and authorization state.

### `/studio/voice`

ATLAS Voice and voice-agent creation surface. Reused and integrated rather than duplicated.

Additional internal sections may be represented through tabs or nested views before adding new top-level routes.

## 7. ATLAS Creative Intelligence Router

The Creative Intelligence Router converts a user request into a canonical provider-neutral plan.

Inputs may include:

- natural-language brief;
- target media type;
- destination or platform;
- brand profile;
- reference assets;
- desired duration;
- aspect ratio;
- resolution;
- language;
- audience;
- accessibility requirements;
- organizational policy.

The Router produces a `CreativePlan` containing:

- normalized objective;
- deliverables;
- creative direction;
- storyboard or scene plan where applicable;
- image prompts;
- video prompts or Director production spec;
- voice script;
- music brief;
- sound-effect cues;
- caption/transcript requirements;
- export targets;
- negative constraints;
- provider capability requirements;
- brand constraints;
- accessibility requirements.

The same plan must be compilable for different execution engines without mutating the user's source brief.

## 8. Prompt Engine

The Prompt Engine is a first-class ATLAS service, not a text box helper.

It must support:

- provider-neutral prompt generation;
- deterministic template expansion where feasible;
- prompt specialization by media type;
- reusable organization presets;
- brand terminology;
- negative constraints;
- accessibility metadata;
- provider adaptation notes;
- prompt export when no engine is connected;
- prompt versioning and provenance.

Prompt export is considered a successful planning outcome but not a generated-media outcome.

## 9. Creative Engine Registry

The current provider model is video-oriented. This design generalizes execution into `CreativeEngine` while preserving compatibility with existing video `ProviderId` contracts during migration.

A creative engine descriptor includes:

- `engineId`;
- display name;
- execution class;
- media capabilities;
- connection/readiness state;
- authorization requirement;
- runtime requirement;
- health/readiness verification method;
- supported formats;
- supported resolutions;
- supported durations;
- supported references;
- estimated cost metadata when verifiable;
- last verified time;
- version metadata when discoverable.

Connection/readiness states remain truthful and should align with existing states where possible:

- `unconfigured`
- `configured-unverified`
- `ready`
- `unavailable`
- `insufficient-credit`
- `error`

Local engines may add runtime detail without creating fake states, for example `runtime_not_installed`, `runtime_stopped`, or `model_missing`, represented as diagnostic reason codes rather than top-level marketing states.

## 10. Initial Zero-Cost-Compatible Engine Classes

These are adapter classes and architectural targets, not claims that a runtime is already installed.

### 10.1 Browser-native media utilities

Potential capabilities:

- Canvas-based image transforms;
- browser audio capture where authorized;
- media playback and preview;
- Web Audio processing where appropriate;
- local caption editing;
- basic image composition;
- client-side export for supported formats.

Browser support must be feature-detected.

### 10.2 FFmpeg adapter

FFmpeg is the preferred open-source media-processing layer when an authorized server/local runtime is actually available.

Target capabilities:

- transcode;
- trim;
- concatenate;
- mux/demux;
- audio extraction;
- waveform/probe metadata;
- thumbnail extraction;
- overlay/composition;
- resize;
- format conversion;
- subtitle burn-in;
- export packaging.

ATLAS must check runtime availability before offering these operations as executable.

### 10.3 Open-source image-generation adapter

Architecture should allow local or self-hosted engines such as ComfyUI-compatible workflows or Stable Diffusion-compatible runtimes. No specific runtime is assumed present.

### 10.4 Open-source voice adapter

Architecture should allow local/self-hosted text-to-speech engines such as Piper/Kokoro-compatible runtimes when actually installed and authorized.

### 10.5 Open-source music/audio adapter

Architecture should allow compatible open-source audio-generation runtimes when sufficient compute exists. The application must not advertise them as live until runtime checks pass.

### 10.6 Free-tier adapters

A free-tier provider may be used only if current authorization, quota, and readiness are verified. Free-tier status must not be hardcoded as permanent.

### 10.7 BYO adapters

Organizations may connect supported provider credentials or endpoints. Secrets remain server-side. The browser receives only capability/readiness information.

### 10.8 Prompt-export adapter

Always available for supported media planning. Produces provider-portable prompts and settings but no asset.

## 11. Domain Model Extensions

### 11.1 CreativePlan

Proposed logical contract:

- `id`
- `organizationId`
- `createdByUserId`
- `title`
- `sourceBrief`
- `mediaKinds`
- `targetDestinations`
- `brandProfileId`
- `referenceAssetIds`
- `deliverables`
- `promptSet`
- `audioPlan`
- `accessibilityPlan`
- `negativeConstraints`
- `enginePreference`
- `createdAt`
- `updatedAt`
- `version`

### 11.2 PromptArtifact

- `id`
- `creativePlanId`
- `mediaKind`
- `providerOrEngineId`
- `prompt`
- `parameters`
- `adaptationNotes`
- `version`
- `createdAt`

### 11.3 BrandProfile

- `id`
- `organizationId`
- `name`
- `logoAssetIds`
- `approvedColorTokens`
- `typographyTokens`
- `toneGuidance`
- `requiredDisclaimers`
- `prohibitedTerms`
- `defaultAspectRatios`
- `defaultExportTargets`
- `createdAt`
- `updatedAt`

Brand profiles are constraints and presets, not unrestricted instructions that can override platform security or policy.

### 11.4 CreatorAsset extension

Existing Creator assets remain the source of truth for persisted media. Extend metadata rather than creating a duplicate asset store.

Additional logical metadata may include:

- source type: generated/imported/exported/reference;
- execution class;
- original engine/provider;
- prompt artifact id;
- checksum/hash when available;
- license/source metadata for imported stock;
- accessibility metadata;
- parent asset/version links;
- export history.

## 12. Provenance and Licensing

Every asset must identify its provenance category:

- user upload;
- organization asset;
- generated by verified engine;
- derived/transformed from another asset;
- imported external asset;
- exported composition.

Generated-media provenance must include the engine/provider identifier and generation job reference where available.

Imported stock or third-party assets must retain source/license metadata when provided. ATLAS must not imply ownership of third-party assets.

## 13. Brand Kit

Brand Kit provides reusable organizational constraints for creative generation and export.

Initial capabilities:

- logos and approved marks;
- brand colors;
- typography tokens;
- tone/style guidance;
- standard intros/outros references;
- required legal/disclaimer text;
- forbidden brand mutations;
- target platform presets.

Brand Kit does not require a separate application. It should integrate with Creator and organization settings.

## 14. Composition and Timeline Direction

The first implementation should provide composition workflows without pretending to be a full professional NLE.

Initial composition functions may include:

- ordered asset sequence;
- trim boundaries;
- duration;
- simple transitions;
- voice/audio track association;
- music association;
- captions/subtitles;
- basic overlay instructions;
- export preset.

Where FFmpeg or another verified media processor is available, these operations may be executed. Otherwise ATLAS stores the composition plan and clearly marks execution unavailable.

## 15. Export

Export is a real operation only when ATLAS can produce or copy a verified file.

Initial export targets:

- source asset download;
- image format conversion where supported;
- audio format conversion where supported;
- video presets when a verified processing engine exists;
- caption files;
- prompt package;
- production manifest.

Target presets may include common aspect ratios such as 16:9, 9:16, 1:1, and 4:3 without assuming a social-platform API connection.

## 16. Publishing

Publishing is separate from export.

A publish action requires:

- `creator.publish` permission;
- a verified destination connection;
- explicit user action;
- validated asset;
- destination-specific validation;
- audit record.

No destination is labeled connected until verified. Publication is deferred when no authorized connector exists.

## 17. UX Design

### 17.1 Creator Home

Show:

- Start creation;
- recent productions;
- recent assets;
- Image Lab;
- ATLAS Director;
- Music Lab;
- Voice & Agents;
- Sound Effects;
- Creator Library;
- engine/provider readiness;
- Brand Kit.

Capability cards should use truthful state badges rather than marketing claims.

### 17.2 Unified Composer

Desktop layout:

- left: creative modes and production outline;
- center: creative brief, prompt plan, storyboard/composition;
- right: engine readiness, constraints, preview, validation.

Tablet:

- main composer;
- collapsible side/context panel.

Mobile:

- single-column flow;
- persistent current mode;
- bottom or inline actions;
- no hover-only behavior.

### 17.3 Required states

- empty;
- drafting;
- validating;
- saving;
- saved;
- engine unavailable;
- engine unconfigured;
- prompt export ready;
- generation queued;
- generation accepted;
- generating;
- generation failed;
- generation completed;
- asset verifying;
- asset verified;
- export running;
- export completed;
- publish unauthorized;
- publish destination unavailable;
- publish success;
- permission denied.

## 18. Data Flow

1. authenticated user opens Creator;
2. server confirms organization context and permissions;
3. user submits or edits a creative brief;
4. Prompt Engine produces or updates `CreativePlan`;
5. Router computes capability requirements;
6. engine registry returns verified readiness candidates;
7. user selects or confirms execution path;
8. server checks permission and readiness again;
9. job is created only when an executable engine is available;
10. engine/provider returns a real result reference;
11. ATLAS validates the asset or output metadata;
12. verified asset is persisted in Creator Library with provenance;
13. composition/export may consume only authorized accessible assets;
14. optional publish performs a new authorization/readiness check.

Prompt export stops after step 7 and stores/returns prompts without creating a generation job or media asset.

## 19. Security and Authorization

All Creator routes remain Identity-gated.

Requirements:

- organization/tenant scoping on all persisted rows;
- server-side permission enforcement;
- no provider secrets in browser bundles or client responses;
- signed or authorized asset access where applicable;
- audit logs for generation, provider configuration, export, and publish;
- no cross-tenant asset references;
- validation of uploaded/imported media metadata;
- explicit authorization before external publication;
- rate and resource controls for expensive local/self-hosted workloads;
- no silent camera, microphone, or location access.

## 20. Accessibility

Creator surfaces must support:

- keyboard navigation;
- semantic labels;
- visible focus;
- screen-reader compatible status updates;
- captions/transcripts for relevant audio/video workflows;
- reduced-motion compatibility;
- high-contrast compatibility;
- no action dependent only on color or hover.

The `CreativePlan` should be able to carry accessibility requirements such as captions, transcript, alt-text intent, audio-description intent, and language.

## 21. Failure Handling

### Engine not installed

Show runtime requirement and keep prompt export available.

### Provider not configured

Do not submit. Offer configuration path only to authorized users. Keep prompt export available.

### Free-tier quota exhausted

Mark current readiness truthfully and offer another verified engine or prompt export.

### Generation fails

Persist failed job status and diagnostic code/message without fabricating an asset.

### Asset cannot be verified

Do not mark generation completed as a usable Library asset until verification criteria pass.

### Export processor unavailable

Preserve composition/export plan and report execution unavailable.

## 22. Migration Strategy

Avoid a breaking rewrite of current video contracts.

Phase migration:

1. introduce media-neutral engine abstractions alongside existing video provider types;
2. adapt existing video providers to the generalized registry;
3. leave ATLAS Director behavior compatible;
4. add image/music/voice/SFX capabilities incrementally;
5. extend CreatorAsset metadata compatibly;
6. move shared readiness UI to the generalized engine registry;
7. retire duplicate provider-only concepts only after all existing tests pass under the new model.

## 23. Implementation Phases

### Phase 1 — Core contracts and truthful engine registry

- introduce `CreativePlan` and media-neutral engine types;
- add cost/execution class;
- adapt current provider readiness;
- add prompt-export engine;
- preserve existing video behavior;
- add unit tests.

### Phase 2 — Unified Creator composer

- extend supported media kinds;
- integrate Prompt Engine;
- add SFX and graphics planning;
- surface engine readiness and prompt export;
- responsive states;
- integration tests.

### Phase 3 — Library and provenance

- extend asset metadata;
- add filters for source/media/provenance;
- link prompt artifacts and productions;
- import/reference workflows;
- audit tests.

### Phase 4 — Zero-cost media processing

- add verified FFmpeg adapter where runtime exists;
- basic transform/export operations;
- captions/subtitles;
- composition plan;
- failure/readiness tests.

### Phase 5 — Optional open-source generation adapters

- local/self-hosted image adapter;
- local/self-hosted voice adapter;
- compatible music/audio adapter;
- runtime health checks;
- resource controls.

### Phase 6 — Brand Kit and publish-ready exports

- BrandProfile;
- export presets;
- destination validation abstraction;
- no external publication until a verified connector is separately configured.

## 24. Testing Strategy

### Unit tests

- Prompt Engine normalization;
- execution-class ranking;
- engine compatibility;
- readiness truthfulness;
- permission predicates;
- prompt-export behavior;
- provenance creation;
- cost-class handling;
- media-kind validation;
- compatibility with existing Director provider compilation.

### Integration tests

- Creator routes remain Identity-gated;
- existing Image/Video/Music/Voice navigation continues to work;
- prompt export does not create a fake generation job;
- unconfigured engines cannot generate;
- configured-but-unverified engines cannot be labeled ready;
- successful generation requires verified asset persistence;
- organization isolation;
- Library search and filters;
- FFmpeg actions remain unavailable when runtime verification fails;
- mobile/desktop key flows.

### Production verification

Before a production claim:

- typecheck;
- unit tests;
- integration tests;
- production build;
- route smoke tests;
- authentication verification;
- permission verification;
- provider/engine readiness verification;
- no secret exposure;
- production domain route verification;
- regression check for ATLAS Director.

## 25. Acceptance Criteria

The first implementation program is complete only when:

- ATLAS still uses the existing Creator route tree;
- a user can create and persist a provider-neutral creative plan;
- prompt export works without a paid provider;
- engine readiness distinguishes unavailable, unconfigured, verified-ready, quota-limited, and error conditions truthfully;
- current video provider behavior is not regressed;
- verified generated/imported assets can be represented in the existing Creator Library model;
- every stored asset has provenance;
- tenant and permission boundaries are enforced server-side;
- no paid provider is required to use the planning, prompt, library, and supported local processing flows;
- no unavailable local/open-source engine is represented as live;
- responsive Creator flows work on desktop, tablet, and mobile;
- tests and production build pass before deployment.

## 26. Non-Negotiable Product Rules

1. Zero-cost-first, not fake-zero-cost.
2. No fabricated outputs.
3. No fake provider or runtime readiness.
4. No client-side provider secrets.
5. No duplicate Creator application.
6. No cross-tenant asset access.
7. No automatic paid credit spend.
8. No third-party stock represented as ATLAS-owned.
9. Every generated/derived asset must retain provenance.
10. Prompt export remains available whenever planning can succeed but generation cannot.
11. Existing superior ATLAS Director functionality must be preserved.
12. Deployment requires verification evidence, not assumptions.

## 27. Master Execution Prompt

The following prompt is the canonical behavioral instruction for the Creator orchestration layer and implementation agents. It is not a replacement for typed domain contracts or server-side authorization.

```text
ATLAS CREATIVE ENGINE — ZERO COST FIRST

Act as the sovereign creative orchestration layer for ATLAS Enterprise Suite.

OBJECTIVE
Transform an authorized user's creative intent into a traceable multimedia production workflow while preferring browser-native, local, open-source, self-hosted, verified free-tier, or already-authorized capabilities before optional paid providers.

FLOW
IDEA
-> normalize intent
-> create creative brief
-> determine deliverables
-> create production plan
-> create storyboard/scenes/shots when relevant
-> produce specialized provider-neutral prompts
-> identify verified compatible engines
-> prefer zero-cost-first execution class
-> execute only when authorization and readiness pass
-> verify real output
-> record provenance
-> store authorized asset
-> compose/export when executable
-> publish only through a separately verified destination connection.

RULES
1. Never claim an engine is connected until a real readiness check succeeds.
2. Never claim media was generated until a real asset/result is verified.
3. Never fabricate metrics, quotas, costs, credits, files, jobs, or URLs.
4. Never expose provider credentials to the client.
5. Reuse ATLAS Creator routes, permissions, tenant boundaries, audit, storage, and domain contracts.
6. Prefer BROWSER-LOCAL > LOCAL-COMPUTE > SELF-HOSTED > VERIFIED FREE-TIER > BYO > PROMPT-EXPORT > PAID-OPTIONAL.
7. Open-source software is not automatically zero monetary cost; disclose runtime requirements.
8. If execution is unavailable, produce the best portable prompt/package instead of simulating generation.
9. Every real asset must carry provenance.
10. Respect creator.read/write/generate/manage_providers/publish/admin permissions.
11. Sensitive operations require server-side authorization and audit.
12. Preserve existing ATLAS Director behavior unless a tested compatible replacement is superior.
13. All important controls must have real behavior or truthful disabled/unavailable states.
14. Maintain responsive desktop/tablet/mobile behavior and accessibility.
15. Do not publish externally without explicit authorization and verified destination readiness.
```

## 28. Decision Summary

Approved architectural direction: **Zero-Cost-First Creative Core**.

ATLAS will become the orchestration and governance layer for multimedia creation rather than a thin wrapper around one commercial provider. The system will remain useful when no paid generation provider is configured by delivering structured planning, portable prompts, library/provenance workflows, and any verified browser/local/self-hosted media processing available to the organization.
