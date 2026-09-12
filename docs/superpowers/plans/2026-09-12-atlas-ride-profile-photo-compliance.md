# ATLAS Ride Profile Photo Compliance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first production-capable ATLAS Ride driver-compliance slice so an authenticated driver can respond to a profile-photo reverification requirement, submit private evidence, and move through an auditable review lifecycle without fabricating biometric verification.

**Architecture:** Add a reusable `packages/compliance` domain layer for lifecycle, permissions, file policy, and eligibility semantics; add a Ride-specific policy layer for profile-photo requirements; keep all sensitive persistence and private-storage operations behind one authenticated Supabase Edge Function; and expose the feature through a protected ATLAS Ride route tree that reuses the existing ATLAS shell, identity/session behavior, and organization membership boundary. The current database has organization-level tenancy but no persisted tenant table, so this slice records `tenant_id = organization_id` explicitly and enforces that equality rather than inventing a second tenancy source of truth.

**Tech Stack:** React 18.3, TypeScript 5.7, Vite 6.4, Vitest 3.2, Testing Library, Supabase Auth/Postgres/RLS/Storage/Edge Functions, Deno, existing ATLAS shell/session utilities.

**Spec:** `docs/superpowers/specs/2026-09-12-atlas-ride-profile-photo-compliance-design.md`

## Global Constraints

- Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`.
- Implementation branch: `feat/ride-profile-photo-compliance`.
- Do not merge or deploy without explicit user approval.
- Reuse `apps/web/src/lib/atlasSession.ts`, `AtlasShell`, `RequireAtlasIdentity`, `organization_members`, Supabase, and existing route/test patterns.
- Do not copy Uber branding, wording, email markup, or logos.
- Do not claim a live Uber, rideshare, facial-recognition, or biometric provider connection.
- Never map `submitted` directly to `approved`.
- The profile image is sensitive identity evidence: store it only in a private Supabase Storage bucket.
- Do not store raw image bytes or base64 image content in Postgres.
- Do not expose permanent public URLs.
- Preview access must use short-lived signed URLs produced only after authorization.
- Do not persist biometric templates, embeddings, inferred identity scores, or fabricated confidence values.
- Every persisted compliance row must carry both `tenant_id` and `organization_id`; for this slice they must be equal because `organizations` is the only persisted tenancy source currently present in the canonical repository.
- Every sensitive transition must create an audit event without image bytes, provider secrets, signed URLs, or biometric material.
- Fine-grained permissions: `ride.compliance.read`, `ride.compliance.submit`, `ride.compliance.review`, `ride.compliance.manage`.
- Drivers may submit only for their own authenticated subject identity.
- Reviewers may act only inside their authorized organization scope.
- Eligibility impact may be shown only when the persisted requirement contains `eligibility_effect`.
- Accepted initial image MIME types: `image/jpeg`, `image/png`, `image/webp`.
- Maximum initial upload size: 10 MiB (`10 * 1024 * 1024` bytes).
- Run `npm ci`, `npm run typecheck`, `npm run test:unit`, `npm run test:integration`, and `npm run build` before declaring implementation complete.
- Production verification is a separate gate and must not be performed without deployment approval.

---

## File Structure

Create or modify these focused units:

- `packages/compliance/types.ts` — shared requirement/submission/audit/permission types.
- `packages/compliance/lifecycle.ts` — legal lifecycle transitions and review rules.
- `packages/compliance/permissions.ts` — explicit permission evaluation.
- `packages/compliance/file-policy.ts` — accepted MIME types, size limits, metadata validation.
- `packages/compliance/index.ts` — stable exports for consumers.
- `packages/ride/compliance.ts` — Ride-specific profile-photo requirement constants and eligibility interpretation.
- `supabase/migrations/20260912_ride_profile_photo_compliance.sql` — compliance tables, constraints, indexes, RLS, private storage bucket declaration.
- `supabase/functions/atlas-ride-compliance/_shared/context.ts` — authenticated user/org/permission resolution.
- `supabase/functions/atlas-ride-compliance/_shared/repository.ts` — requirement, submission, review, timeline, and audit persistence.
- `supabase/functions/atlas-ride-compliance/_shared/storage.ts` — private upload, cleanup, existence checks, and signed previews.
- `supabase/functions/atlas-ride-compliance/_shared/errors.ts` — safe normalized error mapping.
- `supabase/functions/atlas-ride-compliance/index.ts` — thin API router/orchestrator.
- `apps/web/src/lib/rideComplianceApi.ts` — authenticated typed browser API client.
- `apps/web/src/modules/ride/RideRoutes.tsx` — protected Ride route graph.
- `apps/web/src/modules/ride/RideSubnav.tsx` — Ride navigation.
- `apps/web/src/modules/ride/RideHomePage.tsx` — Ride entry page.
- `apps/web/src/modules/ride/DriverHomePage.tsx` — driver/partner entry page.
- `apps/web/src/modules/ride/ComplianceHomePage.tsx` — compliance overview.
- `apps/web/src/modules/ride/DocumentsPage.tsx` — governed documents list/empty state.
- `apps/web/src/modules/ride/ProfilePhotoCompliancePage.tsx` — profile-photo requirement workflow.
- `apps/web/src/modules/ride/ProfilePhotoCapture.tsx` — camera/library/file selection and client decode validation.
- `apps/web/src/modules/ride/ComplianceStatusBadge.tsx` — accessible status rendering.
- `apps/web/src/modules/ride/ComplianceTimeline.tsx` — auditable timeline rendering.
- `apps/web/src/modules/ride/ComplianceReviewPanel.tsx` — authorized manual approve/reject operations.
- `apps/web/src/modules/ride/ride.css` — ATLAS-native responsive Ride styles.
- `apps/web/src/main.tsx` — dispatch `/ride` paths to the protected Ride router and load Ride styles.
- `apps/web/src/App.tsx` — expose ATLAS Ride as an enabled Enterprise module only after its route graph exists.
- `tests/unit/ride-compliance-domain.test.ts` — lifecycle, permissions, file-policy, eligibility tests.
- `tests/integration/ride-compliance-schema-contract.test.ts` — migration/RLS/private-storage contract assertions.
- `tests/integration/ride-compliance-edge-contract.test.ts` — server-boundary and secret-redaction contract assertions.
- `tests/integration/ride-compliance-api.test.ts` — browser API request/response/upload behavior.
- `tests/integration/ride-compliance-routes.test.tsx` — route graph and navigation coverage.
- `tests/integration/ride-profile-photo-page.test.tsx` — capture/upload/status/review UI states.
- `docs/ride/PROFILE_PHOTO_COMPLIANCE_READINESS.md` — final implementation evidence and remaining production gate.

---

### Task 1: Create the shared compliance domain and Ride policy

**Files:**
- Create: `packages/compliance/types.ts`
- Create: `packages/compliance/lifecycle.ts`
- Create: `packages/compliance/permissions.ts`
- Create: `packages/compliance/file-policy.ts`
- Create: `packages/compliance/index.ts`
- Create: `packages/ride/compliance.ts`
- Create: `tests/unit/ride-compliance-domain.test.ts`

**Interfaces:**
- Produces `ComplianceRequirementStatus`, `ComplianceSubmissionStatus`, `CompliancePermission`, `EligibilityEffect`, `ComplianceRequirement`, `ComplianceSubmission`, `ComplianceAuditEvent`.
- Produces `canTransitionRequirement(from, to)`, `canTransitionSubmission(from, to)`, `requireRejectionReason(reason)`, `hasCompliancePermission(granted, required)`, `validateComplianceImageMetadata(input)`, `rideProfilePhotoRequirementType`, and `describeRideEligibilityEffect(effect)`.

- [ ] **Step 1: Write the failing domain tests**

Create `tests/unit/ride-compliance-domain.test.ts` with assertions equivalent to:

```ts
import { describe, expect, it } from 'vitest';
import {
  canTransitionRequirement,
  canTransitionSubmission,
  hasCompliancePermission,
  requireRejectionReason,
  validateComplianceImageMetadata
} from '../../packages/compliance';
import { describeRideEligibilityEffect, rideProfilePhotoRequirementType } from '../../packages/ride/compliance';

describe('ATLAS Ride compliance domain', () => {
  it('never treats submission as approval', () => {
    expect(canTransitionRequirement('action_required', 'submitted')).toBe(true);
    expect(canTransitionRequirement('submitted', 'approved')).toBe(false);
    expect(canTransitionSubmission('submitted', 'approved')).toBe(false);
    expect(canTransitionSubmission('under_review', 'approved')).toBe(true);
  });

  it('requires a rejection reason', () => {
    expect(() => requireRejectionReason('   ')).toThrow('rejection_reason_required');
    expect(requireRejectionReason('Face is not clearly visible')).toBe('Face is not clearly visible');
  });

  it('fails closed on permissions', () => {
    expect(hasCompliancePermission(['ride.compliance.read'], 'ride.compliance.submit')).toBe(false);
    expect(hasCompliancePermission(['ride.compliance.manage'], 'ride.compliance.review')).toBe(true);
  });

  it('accepts only governed image metadata', () => {
    expect(validateComplianceImageMetadata({ mimeType: 'image/jpeg', sizeBytes: 1024 })).toEqual({ ok: true });
    expect(validateComplianceImageMetadata({ mimeType: 'application/pdf', sizeBytes: 1024 })).toEqual({ ok: false, error: 'unsupported_image_type' });
    expect(validateComplianceImageMetadata({ mimeType: 'image/png', sizeBytes: 10 * 1024 * 1024 + 1 })).toEqual({ ok: false, error: 'image_too_large' });
    expect(validateComplianceImageMetadata({ mimeType: 'image/webp', sizeBytes: 0 })).toEqual({ ok: false, error: 'empty_image' });
  });

  it('defines the Ride profile-photo requirement without inventing eligibility', () => {
    expect(rideProfilePhotoRequirementType).toBe('profile_photo');
    expect(describeRideEligibilityEffect(null)).toBeNull();
    expect(describeRideEligibilityEffect('block_new_activity')).toBe('New Ride activity is blocked until this requirement is resolved.');
  });
});
```

- [ ] **Step 2: Run the focused test and verify failure**

```bash
npx vitest run tests/unit/ride-compliance-domain.test.ts
```

Expected: FAIL because the compliance and Ride domain modules do not exist.

- [ ] **Step 3: Implement the normalized types**

Use these exact vocabularies:

```ts
export type ComplianceRequirementStatus =
  | 'action_required'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'expired'
  | 'waived';

export type ComplianceSubmissionStatus =
  | 'uploading'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'superseded';

export type CompliancePermission =
  | 'ride.compliance.read'
  | 'ride.compliance.submit'
  | 'ride.compliance.review'
  | 'ride.compliance.manage';

export type EligibilityEffect = 'none' | 'warning' | 'block_new_activity';
```

Every domain record carrying scope must include:

```ts
export type ComplianceScope = {
  tenantId: string;
  organizationId: string;
};
```

- [ ] **Step 4: Implement transition tables instead of ad hoc conditionals**

In `packages/compliance/lifecycle.ts` define explicit allowed transitions:

```ts
const requirementTransitions: Record<ComplianceRequirementStatus, readonly ComplianceRequirementStatus[]> = {
  action_required: ['submitted', 'waived', 'expired'],
  submitted: ['under_review', 'rejected', 'expired'],
  under_review: ['approved', 'rejected', 'expired'],
  approved: ['expired', 'action_required'],
  rejected: ['action_required', 'submitted', 'expired'],
  expired: ['action_required', 'waived'],
  waived: ['action_required', 'expired']
};

const submissionTransitions: Record<ComplianceSubmissionStatus, readonly ComplianceSubmissionStatus[]> = {
  uploading: ['submitted', 'superseded'],
  submitted: ['under_review', 'rejected', 'superseded'],
  under_review: ['approved', 'rejected', 'superseded'],
  approved: ['superseded'],
  rejected: ['superseded'],
  superseded: []
};
```

`canTransitionRequirement` and `canTransitionSubmission` return boolean only; mutation code in later tasks must still re-check persisted state server-side.

- [ ] **Step 5: Implement permission and file-policy helpers**

`ride.compliance.manage` may satisfy all Ride compliance permissions. Other permissions satisfy only themselves.

Use:

```ts
export const COMPLIANCE_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const COMPLIANCE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
```

`validateComplianceImageMetadata()` must check non-zero size, max size, and MIME membership without trying to infer image content from filename extension.

- [ ] **Step 6: Run tests and typecheck**

```bash
npx vitest run tests/unit/ride-compliance-domain.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/compliance packages/ride tests/unit/ride-compliance-domain.test.ts
git commit -m "feat(ride): add compliance domain contracts"
```

---

### Task 2: Add compliance persistence, RLS, and private storage declaration

**Files:**
- Create: `supabase/migrations/20260912_ride_profile_photo_compliance.sql`
- Create: `tests/integration/ride-compliance-schema-contract.test.ts`

**Interfaces:**
- Produces tables `compliance_requirements`, `compliance_submissions`, `compliance_audit_events`.
- Produces private Storage bucket `atlas-compliance-evidence`.
- Produces organization membership RLS policies and subject/reviewer write boundaries.

- [ ] **Step 1: Write the failing schema contract test**

Create a Vitest test that reads the migration and requires all security-critical clauses:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260912_ride_profile_photo_compliance.sql'), 'utf8');

describe('ATLAS Ride compliance schema contract', () => {
  it('creates scoped compliance records and a private evidence bucket', () => {
    expect(sql).toContain('create table if not exists public.compliance_requirements');
    expect(sql).toContain('create table if not exists public.compliance_submissions');
    expect(sql).toContain('create table if not exists public.compliance_audit_events');
    expect(sql).toContain("'atlas-compliance-evidence'");
    expect(sql).toMatch(/public\s*:\s*false|false\s*,\s*'atlas-compliance-evidence'/i);
  });

  it('enforces RLS and authenticated organization membership', () => {
    expect(sql.match(/enable row level security/g)?.length).toBeGreaterThanOrEqual(3);
    expect(sql).toContain('organization_members');
    expect(sql).toContain('auth.uid()');
    expect(sql).toContain("status = 'active'");
  });

  it('does not create public evidence access', () => {
    expect(sql).not.toMatch(/public\s*:\s*true/i);
    expect(sql).not.toMatch(/create policy[^;]+storage\.objects[^;]+to public/is);
  });
});
```

- [ ] **Step 2: Run the schema test and verify failure**

```bash
npx vitest run tests/integration/ride-compliance-schema-contract.test.ts
```

Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Create the three tables with exact status constraints**

The migration must include:

```sql
status text not null check (status in ('action_required','submitted','under_review','approved','rejected','expired','waived'))
```

for requirements and:

```sql
status text not null check (status in ('uploading','submitted','under_review','approved','rejected','superseded'))
```

for submissions.

Both requirements and submissions must include `tenant_id`, `organization_id`, and `subject_user_id`. Audit rows must include `tenant_id`, `organization_id`, `actor_user_id`, and `subject_user_id`.

- [ ] **Step 4: Encode current canonical tenancy honestly**

Because the repository has `organizations` but no canonical persisted tenant relation, define both columns as organization foreign keys and require equality:

```sql
tenant_id uuid not null references public.organizations(id) on delete cascade,
organization_id uuid not null references public.organizations(id) on delete cascade,
constraint compliance_requirement_scope_check check (tenant_id = organization_id)
```

Use corresponding equality constraints for submissions and audit events. Do not create a new `tenants` table in this feature.

- [ ] **Step 5: Add indexes and uniqueness needed by the profile-photo slice**

Add indexes covering active lookups by `(organization_id, subject_user_id, module, requirement_type, status)`, submissions by `requirement_id`, and audit events by `requirement_id, created_at desc`.

Prevent duplicate simultaneously actionable profile-photo requirements with a partial unique index equivalent to:

```sql
create unique index if not exists compliance_requirements_one_actionable_profile_photo
on public.compliance_requirements (organization_id, subject_user_id, module, requirement_type)
where module = 'ride'
  and requirement_type = 'profile_photo'
  and status in ('action_required','submitted','under_review','rejected');
```

- [ ] **Step 6: Enable RLS and add fail-closed policies**

Requirements and submissions SELECT policies must require an active `organization_members` row for the authenticated user and matching organization. Subject users may read their own rows. Organization roles `owner`, `admin`, and `platform_admin` may read rows in-scope for review.

Submission INSERT policy must require `submitted_by = auth.uid()` and `subject_user_id = auth.uid()` plus active matching organization membership.

Direct authenticated UPDATE of review status must not be broadly granted; reviewer state changes go through the Edge Function and still validate role/permission before persistence.

Audit events must not be directly client-insertable. Reads are allowed only to the subject user or authorized organization reviewer roles.

- [ ] **Step 7: Declare private storage without public browser policy**

Insert/update the bucket declaration so `atlas-compliance-evidence` is private. Do not create public `storage.objects` SELECT or INSERT policies. Uploads and signed previews will be mediated by the Edge Function after authorization using server-side storage access.

- [ ] **Step 8: Run schema contract and integration tests**

```bash
npx vitest run tests/integration/ride-compliance-schema-contract.test.ts
npm run test:integration
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/20260912_ride_profile_photo_compliance.sql tests/integration/ride-compliance-schema-contract.test.ts
git commit -m "feat(ride): add compliance persistence and private storage"
```

---

### Task 3: Build the authenticated Ride compliance Edge Function boundary

**Files:**
- Create: `supabase/functions/atlas-ride-compliance/_shared/context.ts`
- Create: `supabase/functions/atlas-ride-compliance/_shared/repository.ts`
- Create: `supabase/functions/atlas-ride-compliance/_shared/storage.ts`
- Create: `supabase/functions/atlas-ride-compliance/_shared/errors.ts`
- Create: `supabase/functions/atlas-ride-compliance/index.ts`
- Create: `tests/integration/ride-compliance-edge-contract.test.ts`

**Interfaces:**
- Produces `RideComplianceContext` with `userId`, `organizationId`, `tenantId`, `role`, `permissions`, `userClient`, and `storageAdmin`.
- Produces APIs `readiness`, `profile-photo`, `submit-profile-photo`, `preview`, `timeline`, `approve`, `reject`.
- Browser receives normalized records and signed preview URLs only; never service-role credentials or storage admin objects.

- [ ] **Step 1: Write a failing Edge contract test**

Read the Edge Function source files and assert the boundary is present and secrets are server-only:

```ts
expect(indexSource).toContain("case 'profile-photo'");
expect(indexSource).toContain("case 'submit-profile-photo'");
expect(indexSource).toContain("case 'preview'");
expect(indexSource).toContain("case 'approve'");
expect(indexSource).toContain("case 'reject'");
expect(contextSource).toContain('SUPABASE_SERVICE_ROLE_KEY');
expect(indexSource).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
expect(indexSource).not.toMatch(/face[_ -]?match|biometric[_ -]?score|confidence[_ -]?score/i);
```

Also assert that `storage.ts` creates signed previews with an expiry of 300 seconds or less.

- [ ] **Step 2: Run the contract test and verify failure**

```bash
npx vitest run tests/integration/ride-compliance-edge-contract.test.ts
```

Expected: FAIL because the Edge Function does not exist.

- [ ] **Step 3: Implement authenticated context resolution**

Follow the existing Hospitality pattern: build a user-context Supabase client from the request bearer token, call `auth.getUser()`, load one active `organization_members` row, and derive permissions from role.

Use this exact permission mapping:

```ts
function permissionsForRole(role: string): CompliancePermission[] {
  if (['owner', 'admin', 'platform_admin'].includes(role)) {
    return [
      'ride.compliance.read',
      'ride.compliance.submit',
      'ride.compliance.review',
      'ride.compliance.manage'
    ];
  }
  return ['ride.compliance.read', 'ride.compliance.submit'];
}
```

Set `tenantId = organizationId` and document that this mirrors the migration's explicit compatibility constraint.

- [ ] **Step 4: Implement the repository with server-side transition checks**

Create focused methods with these signatures:

```ts
getProfilePhotoRequirement(ctx): Promise<ComplianceRequirement | null>
listTimeline(ctx, requirementId: string): Promise<ComplianceAuditEvent[]>
createProfilePhotoSubmission(ctx, input): Promise<ComplianceSubmission>
markSubmissionUnderReview(ctx, submissionId: string): Promise<ComplianceSubmission>
approveSubmission(ctx, submissionId: string): Promise<{ submission: ComplianceSubmission; requirement: ComplianceRequirement }>
rejectSubmission(ctx, submissionId: string, reason: string): Promise<{ submission: ComplianceSubmission; requirement: ComplianceRequirement }>
recordComplianceAudit(ctx, event): Promise<void>
```

Every write must reload the current persisted state and check legal transitions with the shared domain helpers before mutating.

- [ ] **Step 5: Implement private storage operations**

`storage.ts` must export:

```ts
uploadComplianceEvidence(ctx, input: {
  submissionId: string;
  file: File;
}): Promise<{ bucket: 'atlas-compliance-evidence'; path: string; mimeType: string; sizeBytes: number }>;

removeComplianceEvidence(ctx, path: string): Promise<void>;

createCompliancePreview(ctx, submissionId: string): Promise<{ signedUrl: string; expiresIn: 300 }>;
```

The path must be:

```text
<tenantId>/<organizationId>/<userId>/ride/profile-photo/<submissionId>/<safe-filename>
```

Strip path separators and control characters from the original filename. Do not expose storage admin credentials.

- [ ] **Step 6: Implement one transactional-style submit orchestration**

For `api=submit-profile-photo`:

1. require `ride.compliance.submit`;
2. resolve the current actionable profile-photo requirement for the authenticated user;
3. parse multipart `FormData` with exactly one `photo` file;
4. call `validateComplianceImageMetadata()`;
5. browser/decode validation is performed client-side later, but the server still validates MIME and byte size independently;
6. create a submission in `uploading` state;
7. upload the file privately;
8. update submission to `submitted` and requirement to `submitted` only after storage succeeds;
9. write `submission.uploaded` and `submission.submitted` audit events;
10. if persistence after storage upload fails, remove the uploaded object and return a safe error;
11. never change requirement or submission directly to `approved` in this endpoint.

- [ ] **Step 7: Implement manual review and signed-preview APIs**

`preview`, `approve`, `reject`, and reviewer timeline access require authorization for the subject user or `ride.compliance.review` as applicable. `reject` must require a non-empty rejection reason. `approve` may run only from `under_review`; first reviewer access can transition a submitted item to `under_review` and record `review.started`.

- [ ] **Step 8: Normalize errors**

Map internal errors to stable values such as:

```ts
'authentication_required'
'invalid_session'
'active_organization_required'
'authorization_denied'
'requirement_not_found'
'requirement_not_actionable'
'unsupported_image_type'
'image_too_large'
'empty_image'
'upload_failed'
'state_conflict'
'rejection_reason_required'
'preview_unavailable'
```

Never include service-role keys, raw SQL errors, signed URLs, or storage stack traces in error responses.

- [ ] **Step 9: Run contract tests and typecheck**

```bash
npx vitest run tests/integration/ride-compliance-edge-contract.test.ts tests/unit/ride-compliance-domain.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add supabase/functions/atlas-ride-compliance tests/integration/ride-compliance-edge-contract.test.ts
git commit -m "feat(ride): add authenticated compliance service"
```

---

### Task 4: Add the typed browser API and governed upload client

**Files:**
- Create: `apps/web/src/lib/rideComplianceApi.ts`
- Create: `tests/integration/ride-compliance-api.test.ts`

**Interfaces:**
- Produces `getRideComplianceReadiness()`, `getRideProfilePhotoRequirement()`, `submitRideProfilePhoto(file)`, `getRideComplianceTimeline(requirementId)`, `getRideCompliancePreview(submissionId)`, `approveRideComplianceSubmission(submissionId)`, `rejectRideComplianceSubmission(submissionId, reason)`.
- Reuses `getAtlasAccessToken()` and `getActiveAtlasOrganization()` from `atlasSession.ts`.

- [ ] **Step 1: Write failing client API tests**

Mock global `fetch`, seed `localStorage` with `atlas_access_token`, and assert:

```ts
await getRideProfilePhotoRequirement();
expect(fetch).toHaveBeenCalledWith(
  expect.stringContaining('/functions/v1/atlas-ride-compliance?api=profile-photo'),
  expect.objectContaining({ headers: expect.objectContaining({ authorization: 'Bearer test-token' }) })
);
```

For upload, create a real browser `File` in jsdom and assert `FormData` is sent without manually setting a multipart content type:

```ts
const photo = new File(['jpeg'], 'profile.jpg', { type: 'image/jpeg' });
await submitRideProfilePhoto(photo);
const [, init] = vi.mocked(fetch).mock.calls.at(-1)!;
expect(init?.body).toBeInstanceOf(FormData);
expect((init?.headers as Record<string, string>)['content-type']).toBeUndefined();
```

- [ ] **Step 2: Run and verify failure**

```bash
npx vitest run tests/integration/ride-compliance-api.test.ts
```

Expected: FAIL because `rideComplianceApi.ts` does not exist.

- [ ] **Step 3: Implement JSON requests using the existing ATLAS session pattern**

Use the same token/401-refresh approach as `hospitalityApi.ts`: retrieve `getAtlasAccessToken()`, call the function with `apikey` and `authorization`, and on `401` call `getActiveAtlasOrganization()` to trigger the existing refresh path before retrying once.

- [ ] **Step 4: Implement multipart upload separately**

For `submitRideProfilePhoto`, do not reuse a helper that always forces `'content-type': 'application/json'`. Construct a `FormData`, append `photo`, and let the browser create the multipart boundary.

- [ ] **Step 5: Normalize typed responses**

Define browser-safe types for readiness, requirement, submission, audit timeline, and preview response. `preview` contains only `{ signed_url, expires_in }`; no bucket service credentials.

- [ ] **Step 6: Run tests and commit**

```bash
npx vitest run tests/integration/ride-compliance-api.test.ts
npm run typecheck
git add apps/web/src/lib/rideComplianceApi.ts tests/integration/ride-compliance-api.test.ts
git commit -m "feat(ride): add compliance browser API"
```

Expected: PASS.

---

### Task 5: Add the protected ATLAS Ride route hierarchy and navigation

**Files:**
- Create: `apps/web/src/modules/ride/RideRoutes.tsx`
- Create: `apps/web/src/modules/ride/RideSubnav.tsx`
- Create: `apps/web/src/modules/ride/RideHomePage.tsx`
- Create: `apps/web/src/modules/ride/DriverHomePage.tsx`
- Create: `apps/web/src/modules/ride/ComplianceHomePage.tsx`
- Create: `apps/web/src/modules/ride/DocumentsPage.tsx`
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/App.tsx`
- Create: `tests/integration/ride-compliance-routes.test.tsx`

**Interfaces:**
- Produces working routes `/ride`, `/ride/driver`, `/ride/driver/compliance`, `/ride/driver/compliance/documents`, `/ride/driver/compliance/documents/profile-photo`.
- All Ride routes render inside `AtlasShell` and `RequireAtlasIdentity`.

- [ ] **Step 1: Write failing route tests**

Test the route graph structurally and with Testing Library:

```ts
render(<MemoryRouter initialEntries={['/ride']}><RideRoutes /></MemoryRouter>);
expect(screen.getByRole('heading', { name: /atlas ride/i })).toBeInTheDocument();
expect(screen.getByRole('link', { name: /driver.*partner/i })).toHaveAttribute('href', '/ride/driver');
```

Add equivalent navigation assertions for compliance and documents. For the profile-photo endpoint, assert the route resolves to the profile-photo component rather than a 404 or generic placeholder.

- [ ] **Step 2: Run and verify failure**

```bash
npx vitest run tests/integration/ride-compliance-routes.test.tsx
```

Expected: FAIL because Ride routes do not exist.

- [ ] **Step 3: Build the protected Ride router**

Use the same shell/identity pattern as Hospitality:

```tsx
<AtlasShell>
  <RequireAtlasIdentity>
    <Routes>
      <Route path="/ride" element={<RideHomePage />} />
      <Route path="/ride/driver" element={<DriverHomePage />} />
      <Route path="/ride/driver/compliance" element={<ComplianceHomePage />} />
      <Route path="/ride/driver/compliance/documents" element={<DocumentsPage />} />
      <Route path="/ride/driver/compliance/documents/profile-photo" element={<ProfilePhotoCompliancePage />} />
    </Routes>
  </RequireAtlasIdentity>
</AtlasShell>
```

The profile-photo component may initially render its own loading state until Task 6 supplies the full workflow.

- [ ] **Step 4: Make every hierarchy level useful**

`RideHomePage` links to Driver/Partner. `DriverHomePage` links to Compliance. `ComplianceHomePage` links to Documents & Credentials. `DocumentsPage` contains the Profile Photo entry plus a truthful empty/configuration state for document types not yet configured. Do not render `Coming Soon` buttons.

- [ ] **Step 5: Dispatch `/ride` from the application root**

Modify `RootRouter()` in `main.tsx`:

```tsx
if (location.pathname.startsWith('/hospitality')) return <HospitalityRoutes />;
if (location.pathname.startsWith('/ride')) return <RideRoutes />;
return <App />;
```

Import `RideRoutes` and `ride.css`.

- [ ] **Step 6: Enable the Ride module card only now that the routes exist**

Modify `EnterpriseHome` in `App.tsx` to add an enabled card linking to `/ride`. The card text must describe driver/partner compliance without claiming live dispatch, trips, or provider connectivity.

- [ ] **Step 7: Run routes, integration suite, and commit**

```bash
npx vitest run tests/integration/ride-compliance-routes.test.tsx
npm run test:integration
npm run typecheck
git add apps/web/src/main.tsx apps/web/src/App.tsx apps/web/src/modules/ride tests/integration/ride-compliance-routes.test.tsx
git commit -m "feat(ride): add protected compliance navigation"
```

Expected: PASS.

---

### Task 6: Implement the profile-photo capture and submission workflow

**Files:**
- Create: `apps/web/src/modules/ride/ProfilePhotoCompliancePage.tsx`
- Create: `apps/web/src/modules/ride/ProfilePhotoCapture.tsx`
- Create: `apps/web/src/modules/ride/ComplianceStatusBadge.tsx`
- Create: `apps/web/src/modules/ride/ComplianceTimeline.tsx`
- Create: `tests/integration/ride-profile-photo-page.test.tsx`

**Interfaces:**
- Consumes the browser API from Task 4.
- Produces the complete driver-facing profile-photo submission experience.

- [ ] **Step 1: Write failing UI tests for the truthful lifecycle**

Mock the API layer and assert all critical states:

```ts
it('renders no-action state when no requirement exists', async () => {
  vi.mocked(getRideProfilePhotoRequirement).mockResolvedValue({ requirement: null, permissions: ['ride.compliance.read'] });
  render(<ProfilePhotoCompliancePage />);
  expect(await screen.findByText(/no profile-photo action is currently required/i)).toBeInTheDocument();
});

it('shows action required without claiming approval', async () => {
  vi.mocked(getRideProfilePhotoRequirement).mockResolvedValue(actionRequiredFixture);
  render(<ProfilePhotoCompliancePage />);
  expect(await screen.findByRole('heading', { name: /profile photo update required/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /take or choose photo/i })).toBeEnabled();
  expect(screen.queryByText(/verified by ai|face matched/i)).not.toBeInTheDocument();
});
```

Also test rejected reason, expired state, submitted state, and explicit eligibility effect rendering.

- [ ] **Step 2: Run and verify failure**

```bash
npx vitest run tests/integration/ride-profile-photo-page.test.tsx
```

Expected: FAIL because the workflow components do not exist.

- [ ] **Step 3: Implement the accessible capture control**

`ProfilePhotoCapture` must render a labeled file input with:

```tsx
<input
  type="file"
  accept="image/jpeg,image/png,image/webp"
  capture="user"
  aria-describedby="profile-photo-help"
/>
```

Do not hide the only operable input from assistive technology. A styled label/button may activate it, but keyboard and screen-reader access must remain intact.

- [ ] **Step 4: Decode the selected image before enabling submission**

Use `URL.createObjectURL(file)` and an `Image` instance to confirm the browser can decode it. Revoke the object URL in both success and error paths. First run `validateComplianceImageMetadata()`; then reject decode failure with `image_decode_failed`.

Do not inspect EXIF, infer identity, or compute biometric features.

- [ ] **Step 5: Implement upload states**

The page state machine must expose:

- idle/action required;
- selected/ready to submit;
- uploading;
- submitted;
- validation error;
- upload error.

While uploading, disable duplicate submission. On success, replace the local state with the server-returned requirement/submission and reload the timeline. Do not show `Approved` unless the server returned `approved`.

- [ ] **Step 6: Render lifecycle and privacy context**

Show requested date, due/expiry dates when present, last submitted/reviewed date, rejection reason when present, persisted eligibility effect when non-null, and a privacy statement that the image is private compliance evidence.

`ComplianceStatusBadge` must render text plus visual treatment; color alone may not communicate status.

- [ ] **Step 7: Render timeline only from server audit data**

`ComplianceTimeline` accepts `ComplianceAuditEvent[]`. It must never invent timestamps or events to fill the UI.

- [ ] **Step 8: Run focused tests and commit**

```bash
npx vitest run tests/integration/ride-profile-photo-page.test.tsx tests/unit/ride-compliance-domain.test.ts
npm run typecheck
git add apps/web/src/modules/ride/ProfilePhotoCompliancePage.tsx apps/web/src/modules/ride/ProfilePhotoCapture.tsx apps/web/src/modules/ride/ComplianceStatusBadge.tsx apps/web/src/modules/ride/ComplianceTimeline.tsx tests/integration/ride-profile-photo-page.test.tsx
git commit -m "feat(ride): add profile photo submission workflow"
```

Expected: PASS.

---

### Task 7: Add authorized manual review and short-lived previews

**Files:**
- Create: `apps/web/src/modules/ride/ComplianceReviewPanel.tsx`
- Modify: `apps/web/src/modules/ride/ProfilePhotoCompliancePage.tsx`
- Modify: `tests/integration/ride-profile-photo-page.test.tsx`

**Interfaces:**
- Consumes `getRideCompliancePreview`, `approveRideComplianceSubmission`, `rejectRideComplianceSubmission`.
- Produces reviewer-only approve/reject flow with mandatory rejection reason.

- [ ] **Step 1: Write failing reviewer tests**

Add tests:

```ts
it('does not expose review controls without review permission', async () => {
  vi.mocked(getRideProfilePhotoRequirement).mockResolvedValue(submittedDriverFixture);
  render(<ProfilePhotoCompliancePage />);
  expect(await screen.findByText(/submitted/i)).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument();
});

it('requires a reason before rejection', async () => {
  vi.mocked(getRideProfilePhotoRequirement).mockResolvedValue(submittedReviewerFixture);
  render(<ProfilePhotoCompliancePage />);
  const reject = await screen.findByRole('button', { name: /reject/i });
  expect(reject).toBeDisabled();
  await userEvent.type(screen.getByLabelText(/rejection reason/i), 'Image is too dark');
  expect(reject).toBeEnabled();
});
```

- [ ] **Step 2: Run and verify failure**

```bash
npx vitest run tests/integration/ride-profile-photo-page.test.tsx
```

Expected: FAIL because review controls do not exist.

- [ ] **Step 3: Implement reviewer-only preview loading**

Load a preview URL only when the user explicitly opens the review panel and only when the current response includes `ride.compliance.review` or `ride.compliance.manage`. Do not persist the signed URL in localStorage/sessionStorage. Treat expiration as a reloadable `preview_unavailable` state.

- [ ] **Step 4: Implement approve/reject controls**

Approval calls the server and replaces local state with the returned server state. Rejection requires trimmed non-empty reason, calls the server, and renders the persisted reason after success.

Do not optimistically show approved/rejected before the server response succeeds.

- [ ] **Step 5: Refresh timeline after every review transition**

After approval or rejection, reload timeline so `review.started`, `review.approved`, or `review.rejected` comes from the audit table.

- [ ] **Step 6: Run tests and commit**

```bash
npx vitest run tests/integration/ride-profile-photo-page.test.tsx
npm run typecheck
git add apps/web/src/modules/ride/ComplianceReviewPanel.tsx apps/web/src/modules/ride/ProfilePhotoCompliancePage.tsx tests/integration/ride-profile-photo-page.test.tsx
git commit -m "feat(ride): add compliance review workflow"
```

Expected: PASS.

---

### Task 8: Finish responsive ATLAS-native UX and accessibility states

**Files:**
- Create: `apps/web/src/modules/ride/ride.css`
- Modify: `apps/web/src/modules/ride/ProfilePhotoCapture.tsx`
- Modify: `apps/web/src/modules/ride/ProfilePhotoCompliancePage.tsx`
- Modify: `apps/web/src/modules/ride/ComplianceReviewPanel.tsx`
- Modify: `tests/integration/ride-profile-photo-page.test.tsx`

**Interfaces:**
- Produces desktop/tablet/mobile layouts and accessible state announcements.

- [ ] **Step 1: Add failing accessibility assertions**

Require:

```ts
expect(screen.getByRole('status')).toBeInTheDocument();
expect(screen.getByLabelText(/profile photo/i)).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');
expect(screen.getByText(/private compliance evidence/i)).toBeInTheDocument();
```

For rejection errors, assert a visible element with `role="alert"`.

- [ ] **Step 2: Run the focused test and verify failure**

```bash
npx vitest run tests/integration/ride-profile-photo-page.test.tsx
```

Expected: FAIL until the ARIA/status semantics are implemented.

- [ ] **Step 3: Add ATLAS-native responsive styles**

Use existing ATLAS design variables/classes where present. Add only Ride-specific layout classes. Required breakpoints:

```css
@media (max-width: 1024px) { /* tablet */ }
@media (max-width: 640px) { /* mobile */ }
```

On mobile, stack requirement metadata, capture controls, timeline, and reviewer controls in one column with touch targets of at least 44px height.

- [ ] **Step 4: Add focus, disabled, loading, error, and success treatments**

All interactive controls must have visible `:focus-visible`. Loading buttons use `aria-busy="true"`; server failures use `role="alert"`; successful submission/review changes use `role="status"` with concise text.

- [ ] **Step 5: Verify no status relies on color alone**

Each badge must contain a textual status label such as `Action required`, `Submitted`, `Under review`, `Approved`, `Rejected`, `Expired`, or `Waived`.

- [ ] **Step 6: Run tests, typecheck, and commit**

```bash
npx vitest run tests/integration/ride-profile-photo-page.test.tsx tests/integration/ride-compliance-routes.test.tsx
npm run typecheck
git add apps/web/src/modules/ride tests/integration/ride-profile-photo-page.test.tsx
git commit -m "feat(ride): finish responsive accessible compliance ux"
```

Expected: PASS.

---

### Task 9: Add regression/security verification and full repository validation

**Files:**
- Modify: `tests/integration/ride-compliance-schema-contract.test.ts`
- Modify: `tests/integration/ride-compliance-edge-contract.test.ts`
- Modify: `tests/integration/ride-compliance-api.test.ts`
- Modify: `tests/integration/ride-compliance-routes.test.tsx`
- Modify: `tests/integration/ride-profile-photo-page.test.tsx`

**Interfaces:**
- Produces verification evidence that the complete slice remains fail-closed, tenant/org scoped, and non-biometric.

- [ ] **Step 1: Add explicit negative security assertions**

Require tests that verify source/migration output does not contain:

```ts
expect(allRideSources).not.toMatch(/href=["']#["']/);
expect(allRideSources).not.toMatch(/console\.log\(/);
expect(allRideSources).not.toMatch(/coming soon/i);
expect(allRideSources).not.toMatch(/face[_ -]?match|biometric[_ -]?template|confidence[_ -]?score/i);
expect(migrationSource).not.toMatch(/public\s*:\s*true/i);
```

Also require the migration to include `subject_user_id = auth.uid()` on the subject submission path and organization membership checks.

- [ ] **Step 2: Add API conflict/error tests**

Mock `401`, `403`, `409`, and `500` responses and assert the client never converts them into successful states. A `409 state_conflict` must remain an error that causes the UI to reload server state instead of overwriting it optimistically.

- [ ] **Step 3: Run all Ride-focused tests**

```bash
npx vitest run \
  tests/unit/ride-compliance-domain.test.ts \
  tests/integration/ride-compliance-schema-contract.test.ts \
  tests/integration/ride-compliance-edge-contract.test.ts \
  tests/integration/ride-compliance-api.test.ts \
  tests/integration/ride-compliance-routes.test.tsx \
  tests/integration/ride-profile-photo-page.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Run the complete repository validation sequence**

```bash
npm ci
npm run typecheck
npm run test:unit
npm run test:integration
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 5: Inspect the production bundle/source for accidental secret exposure**

Search source and built assets for server-only identifiers:

```bash
grep -R "SUPABASE_SERVICE_ROLE_KEY\|service_role" apps/web/dist apps/web/src || true
```

Expected: no service-role key value and no browser code reading `SUPABASE_SERVICE_ROLE_KEY`. A textual phrase inside documentation/tests is acceptable only outside `apps/web/dist`.

- [ ] **Step 6: Commit any verification-only test fixes**

```bash
git add tests
if ! git diff --cached --quiet; then git commit -m "test(ride): harden compliance security coverage"; fi
```

---

### Task 10: Record readiness evidence and stop before merge/deploy

**Files:**
- Create: `docs/ride/PROFILE_PHOTO_COMPLIANCE_READINESS.md`

**Interfaces:**
- Produces a factual implementation status document for merge/deploy review.

- [ ] **Step 1: Write readiness evidence from actual command results**

Create the document only after Task 9 passes. Include exact fields:

```markdown
# ATLAS Ride Profile Photo Compliance — Readiness

- Branch: `feat/ride-profile-photo-compliance`
- Spec: `docs/superpowers/specs/2026-09-12-atlas-ride-profile-photo-compliance-design.md`
- Plan: `docs/superpowers/plans/2026-09-12-atlas-ride-profile-photo-compliance.md`
- Typecheck: PASS
- Unit tests: PASS
- Integration tests: PASS
- Build: PASS
- Production deployed: NO
- External biometric provider connected: NO
- Storage model: private Supabase bucket, Edge-Function-mediated upload and signed preview
- Tenant compatibility model: `tenant_id = organization_id` until ATLAS gains a canonical persisted tenant relation
```

Do not write PASS for any command that did not actually pass.

- [ ] **Step 2: Add manual route-flow evidence from local/test execution**

Record whether each route resolved without 404 and whether the following flow was exercised under tests: Ride → Driver/Partner → Compliance → Documents → Profile Photo → select/decode → submit → submitted → reviewer → approve/reject.

Do not claim mobile physical-device validation unless it was actually performed on a supported device.

- [ ] **Step 3: Record remaining production gates**

The document must state that production still requires explicit approval plus real Supabase migration/function deployment, authenticated RLS isolation verification, private upload verification, signed preview verification, and supported-device camera/upload verification.

- [ ] **Step 4: Commit readiness document**

```bash
git add docs/ride/PROFILE_PHOTO_COMPLIANCE_READINESS.md
git commit -m "docs(ride): record compliance readiness evidence"
```

- [ ] **Step 5: Perform final independent review**

Using Subagent-Driven Development, dispatch an independent final reviewer over the complete branch diff against the approved spec. Require the reviewer to check spec coverage, security boundaries, state-transition integrity, storage privacy, route completeness, responsive/accessibility behavior, and tests. Fix all valid findings through TDD and re-run Task 9 validation after fixes.

- [ ] **Step 6: Stop before integration**

Do not merge, push to a protected production branch, apply Supabase production migrations, deploy Edge Functions, or deploy the web application without explicit user approval.

---

## Self-Review Results

### Spec coverage

- Route hierarchy and ATLAS-native navigation: Tasks 5-6.
- Auth/session reuse: Tasks 3-5.
- Tenant/organization boundaries: Tasks 1-3 and 9.
- RBAC: Tasks 1, 3, 7, and 9.
- Private Supabase Storage: Tasks 2-3 and 9.
- Requirement/submission/audit persistence: Tasks 2-3.
- Capture/upload validation: Tasks 1, 3, 4, 6.
- Loading/empty/error/success lifecycle states: Tasks 6-8.
- Manual review: Tasks 3 and 7.
- Signed preview URLs: Tasks 3 and 7.
- Eligibility-effect honesty: Tasks 1 and 6.
- No fake biometric provider: Tasks 1, 3, 6, and 9.
- Responsive/accessibility: Task 8.
- Full verification and independent final review: Tasks 9-10.
- No merge/deploy without approval: Global Constraints and Task 10.

### Placeholder scan

The plan contains no `TBD`, `TODO`, `implement later`, or unspecified error-handling placeholders. Every task defines concrete files, interfaces, tests, commands, and expected outcomes.

### Type consistency

The same status, permission, route, API, and storage names are used throughout the plan. `tenantId` is the TypeScript field name; `tenant_id` is the database field name. `organizationId`/`organization_id` follow the same boundary. The browser API uses normalized response types and never imports server-only storage administration code.
