const MAX_METADATA_BYTES = 16 * 1024;

function invalidJson(): never {
  throw new Error('audit_ledger_invalid_json');
}

function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function normalize(value: unknown): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : invalidJson();
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return invalidJson();
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => compareCodeUnits(a, b))
        .map(([key, item]) => [key, normalize(item)])
    );
  }
  return invalidJson();
}

export function canonicalizeJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}

export function assertBoundedMetadata(metadata: Record<string, unknown>): void {
  const bytes = new TextEncoder().encode(canonicalizeJson(metadata)).byteLength;
  if (bytes > MAX_METADATA_BYTES) throw new Error('audit_ledger_metadata_too_large');
}
