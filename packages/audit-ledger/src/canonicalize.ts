const MAX_METADATA_BYTES = 16 * 1024;

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, normalize(item)])
    );
  }
  return value;
}

export function canonicalizeJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}

export function assertBoundedMetadata(metadata: Record<string, unknown>): void {
  const bytes = new TextEncoder().encode(canonicalizeJson(metadata)).byteLength;
  if (bytes > MAX_METADATA_BYTES) throw new Error('audit_ledger_metadata_too_large');
}
