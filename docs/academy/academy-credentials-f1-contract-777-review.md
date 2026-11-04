# ATLAS Academy & Credentials — F1 contract v0.1

Status: DRAFT / P0 NO-GO. Source: issue #990. Base SHA: e84d93d8e6d3a2f17da3fbbbe8c5d6ea8ee30b12.

## Scope
One reusable education engine, starting with Hospitality Sales — SMERF Fundamentals (6 simulated lessons). Existing `packages/learning` and `apps/web/src/modules/learning` must be inspected and reused where appropriate. Infrastructure TLS certificates and Hospitality room-access credentials are unrelated domains.

## Data contracts (proposed, not migrated)
- Course: id, org_id, slug, version, title, description, published_at, accreditation_claim (default false).
- Lesson: id, course_id, version, sequence, content_ref, accessibility_metadata.
- Enrollment: id, org_id, user_id, course_id, course_version, status.
- Assessment: id, lesson_id, version, rubric_ref, passing_threshold.
- Attempt: id, org_id, enrollment_id, assessment_id, rubric_version, submitted_at, server_score, evidence_hash, immutable status.
- Credential: id, org_id, enrollment_id, course_version, issue_time, evidence_digest, status (issued/revoked), public_verification_token_digest.
- AuditEvent: id, org_id, actor_id, event_type, target_id, occurred_at, integrity_ref.

## P0 invariants
1. All authorization and scores computed server-side; client submissions cannot set pass/fail, issue_time or credential status.
2. Active organization membership and least-privilege role required for private reads and writes; cross-tenant reads/writes denied by RLS.
3. Credential issuance requires server-verified passing attempts for every mandatory assessment in the pinned course version; atomic idempotent issuance under concurrent workers.
4. Public verification returns minimal fields (course, issuer, issuance date, valid/revoked), no private learner profile or assessment answers; unguessable verification token.
5. Revocation is audited and takes effect immediately; previously rendered PDF/QR must resolve to revoked status.
6. No fabricated external accreditation, issuer signature, course completion, instructor identity, or employment qualification.
7. Fail closed on unavailable auth, database, evidence, payment or verification service.
8. All sensitive records retained/deleted under documented policy; no student data in logs, telemetry, URLs or public object storage.

## TDD negative cases
ACA-01 missing mandatory assessment => issuance denied.
ACA-02 forged client score => ignored/rejected.
ACA-03 cross-tenant attempt/credential access => denied.
ACA-04 concurrent duplicate issuance => one credential.
ACA-05 revoked credential => verification reports revoked.
ACA-06 invalid/guessed verification token => no data leak.
ACA-07 changed course version => prior attempts not silently applied.
ACA-08 signed-out or revoked member => all privileged operations denied.
ACA-09 payment failure => no paid entitlement.
ACA-10 inaccessible lesson controls => accessibility gate fails.

## Acceptance and release gates
F1 review of schemas, privacy, RBAC/RLS and migration plan; F2 automated negative tests; F3 accessible course runtime; F4 verifiable credentials; F5 tenant isolation; F6 sandbox commerce; F7 exact-SHA CI, E2E and controlled deployment. No merge/deploy/real billing before P0 evidence and required authorization.
