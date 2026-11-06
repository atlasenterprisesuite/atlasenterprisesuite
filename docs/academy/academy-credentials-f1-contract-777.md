# ATLAS Academy & Credentials — F1 domain contract

Status: DRAFT / NOT PRODUCTION VERIFIED. Tracks #990. This document is not an authorization to issue accredited credentials.

## Reuse boundary
Reuse existing Learning UI and Supabase organization identity patterns only after confirming permissions. Infrastructure TLS certificates and hospitality room credentials are separate domains.

## Domain objects (versioned)
- Course: id, org_id, slug, title, language, content_version, publication_state, accreditation_claim (default none).
- Lesson: id, course_id, ordinal, learning_objectives, content_version.
- Enrollment: id, org_id, user_id, course_id, course_version, status.
- Assessment: id, course_version, rubric_version, pass_threshold, immutable answer key (server-only).
- Attempt: id, enrollment_id, assessment_id, submitted_at, score, evaluator_version, evidence_digest, idempotency_key.
- Credential: id (opaque), org_id, enrollment_id, issued_at, status, issuer, template_version, evidence_digest, revocation_at.
- AuditEvent: id, org_id, actor_id, action, object_id, occurred_at, request_id.

## Invariants — P0 fail closed
1. No client-submitted score can trigger completion or credential issuance; score calculated and recorded server-side.
2. Issuance requires authenticated org membership, course version, passing rubric, durable evidence, and authorized issuer.
3. Unique idempotency key per issuance and transactional locking prevent duplicate issuance under concurrent requests.
4. Tenant isolation enforced in database RLS AND authorization on service endpoints; negative cross-tenant tests required.
5. Public verification returns only minimum consented fields and status (valid/revoked/not found), with enumeration-resistant opaque IDs.
6. Revocation is audited and irreversible as a status transition; reissue creates a new credential linked to original.
7. No accreditation, hotel employment, Hilton endorsement, or fictitious signature may be implied.
8. Payment processing stays in sandbox until separate explicit authorization and verified provider integration.
9. Every release requires exact-SHA CI, security negatives, accessibility and end-to-end evidence before GO.

## Pilot: Hospitality Sales — SMERF Fundamentals
Six lessons: discovery, quotation, negotiation, CRM, prospecting, final KPIs/interview. Historical chat responses are illustrative, not authenticated exam evidence. Initial certificates must state educational simulation, not professional accreditation.

## TDD cases
- ACAD-01 reject forged client score
- ACAD-02 reject mismatched course/rubric version
- ACAD-03 reject tenant-crossing read/write/issue/revoke
- ACAD-04 reject duplicate concurrent issuance
- ACAD-05 reject unauthenticated verification of private learner data
- ACAD-06 revoke and verify status without exposing personal data
- ACAD-07 reject issuance without evidence or authorization
- ACAD-08 ensure accessible keyboard/mobile course flow
- ACAD-09 prohibit unsupported accreditation claims
- ACAD-10 verify immutable audit trail and exact-SHA pipeline

## Next gate
Implement isolated failing tests and schemas on this branch; do not merge or deploy while P0 evidence is missing.


## F2.45 — Transactional issuance design gate (design only, NOT implemented)

Academic credentials are distinct from Hospitality physical-access credentials.
The current `evaluateAuthorizedAcademyAttempt` returns a grade only and does not
persist an attempt, create a credential, or authorize issuance.

A future trusted **server-side** issuer MUST enforce the following in one
database transaction, under an authenticated actor and tenant-scoped role:

1. Derive `actor_id` and `org_id` from trusted authentication, never from
   request fields. Validate issuer capability and tenant membership; enforce
   database RLS in addition to endpoint RBAC.
2. Lock the target enrollment row with `SELECT ... FOR UPDATE`, scoped by
   `org_id`, `user_id`, course/version and active status. Revocation must
   acquire the **same enrollment-row lock** before changing status.
3. After acquiring the lock, revalidate active enrollment, passing
   server-calculated assessment, immutable rubric/version and durable evidence.
   Do not trust a previous grade response as issuance authorization.
4. Atomically insert the credential, unique tenant-scoped idempotency record,
   and immutable audit event. A retry with the same key and same request
   digest returns the same result; a reused key with a different digest
   fails closed. On any audit failure, roll back the entire transaction.
5. A revocation that wins the row lock first prevents issuance. If issuance
   wins first, revocation must subsequently invalidate the credential and
   record an audit event. Define and test the ordering contract explicitly.
6. Public verification requires opaque, enumeration-resistant IDs and a
   separately authorized minimum-data projection; never expose enrollment,
   assessment answers, private learner identity or tenant records by default.

**Required RED tests before implementation:** two sessions with a deterministic
barrier for revocation-before-issuance and issuance-before-revocation; two
workers using one idempotency key; cross-tenant read/write/issue/revoke under
a non-BYPASSRLS role; audit insert failure rollback; revoked credential
verification; mismatched digest replay; no public enumeration; keyboard and
screen-reader accessible verification. Inspect actual PostgreSQL lock waits
and exact-SHA CI logs. A synthetic fixture is not proof of a production
issuer.

**Current gate:** P0 NO-GO. This section is a design contract, not an
implementation or CI result.
