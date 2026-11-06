/** Isolated server-only issuer contract. No production adapter is provided.
 * A trusted adapter MUST run transaction() as one real database transaction
 * with non-BYPASSRLS role, trusted session identity, enrollment FOR UPDATE,
 * unique (org,idempotencyKey), and atomic audit persistence. In-memory
 * callbacks are NOT proof of these database guarantees.
 */
export interface AcademyIssuerActor {
  userId: string;
  organizationId: string;
  capabilities: readonly string[];
}
export interface AcademyIssueRequest {
  enrollmentId: string;
  courseVersion: string;
  rubricVersion: string;
  evidenceDigest: string;
  idempotencyKey: string;
}
export interface AcademyIssuerTransaction {
  lockEnrollment(args: { enrollmentId: string; organizationId: string; userId: string }): Promise<{
    id: string; userId: string; organizationId: string; courseVersion: string; status: string;
  } | null>;
  getExisting(args: { organizationId: string; idempotencyKey: string }): Promise<{
    evidenceDigest: string; requestFingerprint: string; credentialId: string; status: string;
  } | null>;
  getVerifiedAssessment(args: { enrollmentId: string; organizationId: string; courseVersion: string }): Promise<{
    passed: boolean; rubricVersion: string; evidenceDigest: string;
  } | null>;
  insertCredential(args: { organizationId: string; enrollmentId: string; evidenceDigest: string }): Promise<{
    id: string; status: string;
  }>;
  insertIdempotency(args: { organizationId: string; idempotencyKey: string; evidenceDigest: string; requestFingerprint: string; credentialId: string }): Promise<void>;
  appendAudit(args: { organizationId: string; actorId: string; action: string; credentialId: string }): Promise<void>;
}
export interface AcademyIssuerStore {
  authenticate(): Promise<AcademyIssuerActor | null>;
  transaction<T>(run: (tx: AcademyIssuerTransaction) => Promise<T>, actor?: AcademyIssuerActor): Promise<T>;
}
const valid = (s: unknown): s is string => typeof s === 'string' && s.trim().length > 0;

/** A passed grade alone never grants issuance. Requires trusted durable evidence. */
export async function issueAcademyCredential(request: AcademyIssueRequest, store: AcademyIssuerStore): Promise<{ id: string; status: string }> {
  if (!request || !valid(request.enrollmentId) || !valid(request.courseVersion) ||
      !valid(request.rubricVersion) || !valid(request.evidenceDigest) ||
      !valid(request.idempotencyKey) || !/^sha256:[a-zA-Z0-9_-]+$/.test(request.evidenceDigest)) {
    throw new Error('Invalid credential request');
  }
  const actor = await store.authenticate();
  if (!actor || !valid(actor.userId) || !valid(actor.organizationId) ||
      !Array.isArray(actor.capabilities) || !actor.capabilities.includes('academy:issue')) {
    throw new Error('Unauthorized credential issuance');
  }
  // Canonical tuple binds idempotency to all security-relevant request dimensions.\n  // The durable adapter must store and compare this exact tuple under a unique key.\n  const requestFingerprint = JSON.stringify([actor.organizationId, actor.userId, request.enrollmentId, request.courseVersion, request.rubricVersion, request.evidenceDigest]);\n  return store.transaction(async tx => {
    const enrollment = await tx.lockEnrollment({
      enrollmentId: request.enrollmentId, organizationId: actor.organizationId, userId: actor.userId
    });
    if (!enrollment || enrollment.id !== request.enrollmentId ||
        enrollment.userId !== actor.userId || enrollment.organizationId !== actor.organizationId ||
        enrollment.courseVersion !== request.courseVersion || enrollment.status !== 'active') {
      throw new Error('Unauthorized enrollment');
    }
    const previous = await tx.getExisting({ organizationId: actor.organizationId, idempotencyKey: request.idempotencyKey });
    if (previous) {
      if (previous.evidenceDigest !== request.evidenceDigest || previous.requestFingerprint !== requestFingerprint || !valid(previous.credentialId) || !['active', 'revoked'].includes(previous.status)) {
        throw new Error('Idempotency conflict');
      }
      return { id: previous.credentialId, status: previous.status };
    }
    const assessment = await tx.getVerifiedAssessment({
      enrollmentId: request.enrollmentId, organizationId: actor.organizationId, courseVersion: request.courseVersion
    });
    if (!assessment || assessment.passed !== true ||
        assessment.rubricVersion !== request.rubricVersion ||
        assessment.evidenceDigest !== request.evidenceDigest) {
      throw new Error('Unverified assessment evidence');
    }
    const credential = await tx.insertCredential({
      organizationId: actor.organizationId, enrollmentId: request.enrollmentId, evidenceDigest: request.evidenceDigest
    });
    if (!credential || !valid(credential.id) || credential.status !== 'active') throw new Error('Invalid credential persistence');
    await tx.insertIdempotency({
      organizationId: actor.organizationId, idempotencyKey: request.idempotencyKey,
      evidenceDigest: request.evidenceDigest, requestFingerprint, credentialId: credential.id
    });
    await tx.appendAudit({
      organizationId: actor.organizationId, actorId: actor.userId, action: 'academy.credential.issued', credentialId: credential.id
    });
    return credential;
  }, actor);
}
