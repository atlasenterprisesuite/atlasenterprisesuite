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
