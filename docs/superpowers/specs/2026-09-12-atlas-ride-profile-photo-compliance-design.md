# ATLAS Ride — Profile Photo Compliance Design

Date: 2026-09-12
Status: Approved design, pre-implementation
Owner module: ATLAS Ride
Secondary integration: ATLAS Identity / shared compliance infrastructure
Branch: `feat/ride-profile-photo-compliance`

## 1. Purpose

Implement a real ATLAS Ride identity/compliance flow for driver or partner profile-photo reverification. The visual reference is treated as a product specification for the underlying behavior: a driver can be required to resubmit a profile photo, the requirement can affect operational eligibility, and ATLAS must track the submission and review lifecycle without fabricating approval or a live biometric provider.

This is not a copy of Uber branding or email UI. It is an ATLAS-native implementation of the represented function.

## 2. Existing ATLAS context

The canonical repository is `atlasenterprisesuite/atlasenterprisesuite` with `main` as the production-stable branch. The primary web app is `apps/web`. Existing application patterns include:

- shared application shell and routing;
- ATLAS identity/session handling;
- module-level navigation;
- permission-gated operations;
- explicit loading, empty, error, blocked, and success states;
- Supabase as the primary backend direction;
- provider/readiness boundaries that do not pretend an external dependency is live.

ATLAS Hospitality already demonstrates a useful pattern for permission-gated lifecycle operations and provider-readiness checks, but Ride compliance must have its own domain model because room credentials and driver identity evidence are different concerns.

## 3. Classification

This is an architectural change because `apps/web/src/modules` does not currently contain an ATLAS Ride module or driver-compliance route tree.

The implementation must add the minimum Ride compliance architecture required for this feature while keeping reusable identity/compliance primitives separate from Ride-specific policy.

## 4. Goals

The first production-capable slice must:

1. Expose an ATLAS Ride route for driver/partner compliance.
2. Represent a profile-photo reverification requirement.
3. Allow an authorized driver to capture or upload a new profile photo.
4. Validate file type, size, and image presence before upload.
5. Store evidence in private Supabase Storage rather than public URLs or base64 database fields.
6. Persist requirement and submission lifecycle state in Supabase.
7. Enforce tenant, organization, actor, and role boundaries.
8. Record audit events for sensitive operations.
9. Support reviewer actions when the authenticated actor has review permission.
10. Prevent a mere upload from being represented as approved identity verification.
11. Represent provider-dependent review honestly when no automated biometric provider is connected.
12. Work on desktop, tablet, and mobile.
13. Provide usable loading, empty, blocked, validation-error, upload-error, submitted, review, approved, rejected, and expired states.
14. Integrate into ATLAS navigation without duplicating shell or session infrastructure.

## 5. Non-goals for this slice

This feature will not:

- reproduce Uber branding, wording, or email templates;
- claim to connect to Uber or another rideshare provider;
- perform facial recognition unless an authorized provider is later integrated;
- invent a biometric match score;
- expose images through public storage;
- implement every Ride document type in the first change;
- automatically suspend or reactivate a driver without an explicit policy/eligibility rule in the backend;
- add unrelated Ride dispatch, mapping, trip, pricing, payment, or fleet functionality.

## 6. Recommended architecture

### 6.1 Domain split

Use two layers:

**Shared compliance/identity layer**

Responsible for evidence requirements, submissions, storage references, lifecycle states, permissions, and audit hooks that can later support other ATLAS modules.

**ATLAS Ride compliance layer**

Responsible for driver/partner-specific requirement types, Ride navigation, eligibility interpretation, review policy, and presentation.

This prevents future duplication for driver license, insurance, registration, inspection, background-check references, and other expiring credentials.

### 6.2 Route hierarchy

Primary route:

`/ride/driver/compliance/documents/profile-photo`

Supporting route hierarchy:

- `/ride`
- `/ride/driver`
- `/ride/driver/compliance`
- `/ride/driver/compliance/documents`
- `/ride/driver/compliance/documents/profile-photo`

The route tree must preserve forward and backward navigation through ATLAS shell navigation, Ride subnavigation, breadcrumbs or equivalent established patterns.

## 7. UX design

### 7.1 Profile-photo compliance page

The page must show:

- ATLAS Ride module identity;
- requirement title, for example `Profile photo update required`;
- explanatory text describing why a new photo is required;
- current lifecycle status;
- date requested;
- last submitted/reviewed timestamp when present;
- reviewer decision reason when rejected;
- action button to capture or upload a replacement image when allowed;
- operational eligibility impact when a policy record explicitly defines one;
- security/privacy note explaining that the image is private compliance evidence.

### 7.2 Primary actions

Mobile:

- prefer camera capture through a file input compatible with device camera selection;
- allow library upload when supported.

Desktop/tablet:

- support file upload;
- support camera capture only if the browser/device exposes it without adding an unnecessary new provider or dependency.

### 7.3 Lifecycle states

Requirement status:

- `action_required`
- `submitted`
- `under_review`
- `approved`
- `rejected`
- `expired`
- `waived`

Submission status:

- `uploading`
- `submitted`
- `under_review`
- `approved`
- `rejected`
- `superseded`

The UI must not map `submitted` to `approved`.

### 7.4 Empty/configuration behavior

If no profile-photo requirement exists for the current driver, render a real empty state such as `No profile-photo action is currently required`.

If the backend tables or storage configuration are unavailable, render a configuration/error boundary. Do not populate synthetic compliance records.

## 8. Data model

Use Supabase migrations and Row Level Security.

### 8.1 `compliance_requirements`

Minimum fields:

- `id uuid primary key`
- `organization_id uuid not null`
- `tenant_id uuid not null`
- `subject_user_id uuid not null`
- `module text not null`
- `subject_type text not null`
- `requirement_type text not null`
- `status text not null`
- `requested_at timestamptz not null`
- `due_at timestamptz null`
- `expires_at timestamptz null`
- `eligibility_effect text null`
- `reason_code text null`
- `reason_text text null`
- `created_by uuid null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

For this feature:

- `module = 'ride'`
- `subject_type = 'driver'`
- `requirement_type = 'profile_photo'`

### 8.2 `compliance_submissions`

Minimum fields:

- `id uuid primary key`
- `requirement_id uuid not null references compliance_requirements(id)`
- `organization_id uuid not null`
- `tenant_id uuid not null`
- `subject_user_id uuid not null`
- `submitted_by uuid not null`
- `status text not null`
- `storage_bucket text not null`
- `storage_path text not null`
- `mime_type text not null`
- `file_size_bytes bigint not null`
- `sha256 text null`
- `submitted_at timestamptz not null`
- `reviewed_at timestamptz null`
- `reviewed_by uuid null`
- `decision_reason text null`
- `provider_reference text null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`

Do not store raw image bytes or base64 content in these tables.

### 8.3 `compliance_audit_events`

Minimum fields:

- `id uuid primary key`
- `organization_id uuid not null`
- `tenant_id uuid not null`
- `actor_user_id uuid not null`
- `subject_user_id uuid not null`
- `requirement_id uuid null`
- `submission_id uuid null`
- `event_type text not null`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null`

Events for this slice include:

- `requirement.viewed`
- `submission.started`
- `submission.uploaded`
- `submission.failed`
- `submission.submitted`
- `review.started`
- `review.approved`
- `review.rejected`
- `submission.superseded`

Audit metadata must not contain image bytes, secret tokens, private signed URLs, or biometric templates.

## 9. Storage model

Create or reuse a private Supabase Storage bucket dedicated to compliance evidence. If an existing private governed evidence bucket already satisfies the requirements, reuse it instead of creating a duplicate.

Preferred logical path:

`<tenant_id>/<organization_id>/<subject_user_id>/ride/profile-photo/<submission_id>/<filename>`

Rules:

- bucket is private;
- client never receives a permanent public URL;
- preview access uses short-lived signed URLs created only after authorization;
- replacement uploads create new submission records and do not silently mutate historical evidence;
- deleted/superseded evidence follows ATLAS retention policy rather than ad hoc client deletion.

## 10. Permissions and authorization

Minimum permissions:

- `ride.compliance.read`
- `ride.compliance.submit`
- `ride.compliance.review`
- `ride.compliance.manage`

Rules:

- a driver with submit permission may submit only for their own authenticated subject identity unless an explicit delegated workflow exists;
- a reviewer may review only records inside authorized tenant/organization scope;
- manager actions require the stronger manage permission;
- RLS must enforce ownership/scope server-side rather than relying only on hidden UI controls;
- storage policies must mirror database authorization boundaries.

## 11. Eligibility behavior

The UI may show that a requirement affects eligibility only when the backend requirement includes an explicit `eligibility_effect`.

Recommended values:

- `none`
- `warning`
- `block_new_activity`

No generic client-side rule may infer suspension from status alone.

The first slice should surface the effect but avoid adding a separate automated driver-suspension engine unless one already exists in the repository.

## 12. File validation

Before upload, validate at minimum:

- accepted image MIME types defined by server policy;
- non-zero file size;
- maximum file size defined centrally;
- ability for the browser to decode the selected image;
- reject unsupported files with a visible validation message.

Do not trust client MIME alone. Server/storage policy must remain authoritative.

Optional EXIF removal or server-side image normalization may be added only if it can be implemented with existing infrastructure without introducing a heavyweight dependency. It is not required for the initial slice.

## 13. Review modes

### 13.1 Manual review mode

This is the default mode when no automated identity provider is verified.

Flow:

`action_required -> submitted -> under_review -> approved | rejected`

A reviewer with `ride.compliance.review` can approve or reject and must provide a reason on rejection.

### 13.2 External provider mode

A later provider integration may add automated checks, but only when readiness is verified. The submission can carry `provider_reference`, never provider secrets or full provider payloads containing unnecessary sensitive material.

Until such integration exists, ATLAS must not display labels such as `face matched`, `identity verified by AI`, or a fabricated confidence score.

## 14. Application components

Expected web components, adapted to existing repository patterns:

- `RideRoutes`
- `RideSubnav`
- `RideHome`
- `DriverHome`
- `ComplianceHome`
- `DocumentsPage`
- `ProfilePhotoCompliancePage`
- `ProfilePhotoCapture`
- `ComplianceStatusBadge`
- `ComplianceTimeline`
- `ComplianceReviewPanel`

Shared logic should live outside the Ride presentation layer when it is generic enough to support future compliance document types.

Avoid one monolithic component that owns routing, upload, review, persistence, and presentation together.

## 15. Client/backend boundary

The web client should call a typed ATLAS service layer rather than embedding Supabase queries throughout presentation components.

The service boundary should support operations equivalent to:

- get current Ride compliance requirement;
- list driver compliance requirements;
- create submission intent;
- upload evidence;
- finalize submission;
- obtain authorized preview URL;
- approve submission;
- reject submission;
- list audit/timeline entries allowed for the current actor.

The implementation should reuse existing session and Supabase client utilities where present.

## 16. Error handling

Required user-visible errors include:

- unauthenticated session;
- missing permission;
- requirement not found;
- requirement already satisfied or no longer actionable;
- unsupported file;
- oversized file;
- upload failure;
- finalize/persistence failure;
- expired signed preview URL;
- reviewer conflict when another decision already changed the state;
- backend unavailable.

State transitions must be idempotent or conflict-safe where practical. A failed finalize step must not leave the UI claiming that submission succeeded.

## 17. Responsive and accessibility requirements

The feature must support desktop, tablet, and mobile.

Accessibility requirements include:

- semantic headings and landmarks;
- associated labels for inputs;
- keyboard-operable actions;
- visible focus states;
- status announcements for upload/review success or failure;
- no meaning conveyed by color alone;
- sufficient contrast using ATLAS design tokens;
- camera/upload controls that retain an accessible file-input path;
- readable validation messages.

## 18. Security and privacy

Profile photos are sensitive identity evidence.

Implementation requirements:

- private storage only;
- least-privilege access;
- short-lived signed previews;
- no secrets in source control, logs, query strings, or audit metadata;
- no permanent client-cached public URL;
- RLS and storage policy tests;
- tenant/organization isolation;
- audit trail for review decisions;
- avoid logging filenames when they reveal unnecessary personal data;
- never produce or persist biometric templates unless a separately approved biometric design is implemented.

## 19. Testing strategy

Use TDD.

### 19.1 Unit tests

Cover:

- lifecycle transition rules;
- file validation;
- permission helpers;
- eligibility-effect rendering rules;
- mapping between backend status and UI state;
- rejection reason requirements;
- prevention of upload-equals-approved behavior.

### 19.2 Component/integration tests

Cover:

- action-required page;
- empty/no-requirement state;
- selecting a valid photo;
- invalid file rejection;
- upload loading and failure;
- successful submission state;
- reviewer approve/reject flows;
- permission-blocked actions;
- expired/rejected states;
- navigation through Ride compliance routes.

### 19.3 Backend/RLS tests

Cover:

- driver can read and submit own authorized requirement;
- driver cannot read another tenant/user requirement;
- unauthorized driver cannot review;
- authorized reviewer can review within scope;
- reviewer cannot cross tenant boundary;
- storage upload/read policies enforce the same scope;
- audit record is created for sensitive transitions.

### 19.4 Repository validation

Before completion run the repository’s required checks, including as applicable:

- `npm run typecheck`
- `npm test`
- `npm run build`

Also verify affected routes do not return 404/500 and exercise desktop/tablet/mobile layouts.

## 20. Implementation sequence

Recommended order:

1. Inspect current Supabase/session/permission utilities and route architecture.
2. Add lifecycle/domain types and failing unit tests.
3. Add Supabase migration, RLS, and private-storage policies with tests.
4. Add typed compliance service layer.
5. Add minimal Ride route hierarchy and navigation.
6. Implement profile-photo requirement page with empty/blocked states.
7. Implement capture/upload and submission lifecycle.
8. Implement reviewer panel and audit timeline.
9. Add responsive/accessibility coverage.
10. Run full validation and perform an independent review before proposing integration.

## 21. Rollout and production boundary

The implementation can be merged only after repository validation passes and the user explicitly approves merge.

Deployment is separate from merge and requires explicit approval if it affects production.

Production verification must confirm:

- production route loads;
- real authentication/session boundary works;
- RLS denies cross-tenant access;
- private upload and signed preview work;
- no public evidence URL is exposed;
- submission state persists;
- reviewer decision persists and is audited;
- mobile capture/upload path works on a supported device;
- no external biometric status is shown unless its integration is actually verified.

## 22. Definition of done

This feature is complete only when:

- the Ride profile-photo compliance route exists and is navigable;
- a real authenticated user with permission can submit evidence;
- evidence is stored privately;
- lifecycle state persists;
- reviewer authorization is enforced;
- approve/reject decisions are audited;
- no upload is falsely represented as verification;
- tenant/RBAC/storage boundaries have passing tests;
- loading, empty, blocked, error, submitted, under-review, approved, rejected, and expired states are represented where applicable;
- desktop/tablet/mobile behavior has been checked;
- typecheck, tests, and build pass;
- no secrets or fabricated live integrations were introduced;
- merge and deploy remain gated by explicit approval.
