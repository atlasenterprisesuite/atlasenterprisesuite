/** ATLAS Memory Archive: pure validation only. No external I/O. */
export type MemorySource = Readonly<{
  tenantId: string;
  organizationId: string;
  sourceId: string;
  content: string;
  sha256: string;
  consentActive: boolean;
}>;

export function validateMemorySource(source: MemorySource, scope: {
  tenantId: string; organizationId: string;
}): void {
  if (!scope.tenantId || !scope.organizationId ||
      source.tenantId !== scope.tenantId ||
      source.organizationId !== scope.organizationId) {
    throw new Error('memory_scope_denied');
  }
  if (!source.consentActive) throw new Error('memory_consent_revoked');
  if (!source.sourceId.trim() || !source.content.trim()) throw new Error('memory_source_empty');
  if (!/^[a-f0-9]{64}$/.test(source.sha256)) throw new Error('memory_invalid_digest');
}

export async function verifyMemorySource(source: MemorySource, scope: {
  tenantId: string; organizationId: string;
}): Promise<boolean> {
  validateMemorySource(source, scope);
  const digest = new Uint8Array(await crypto.subtle.digest(
    'SHA-256', new TextEncoder().encode(source.content)
  ));
  const hex = [...digest].map(x => x.toString(16).padStart(2, '0')).join('');
  if (hex !== source.sha256) throw new Error('memory_integrity_mismatch');
  return true;
}

export function memoryIdempotencyKey(source: MemorySource): string {
  if (!source.tenantId || !source.organizationId || !source.sourceId ||
      !/^[a-f0-9]{64}$/.test(source.sha256)) throw new Error('memory_invalid_identity');
  return [source.tenantId, source.organizationId, source.sourceId, source.sha256]
    .map(value => `${value.length}:${value}`).join('|');
}
