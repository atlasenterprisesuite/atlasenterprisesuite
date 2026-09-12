const MAX_METADATA_BYTES = 16 * 1024;

function invalidJson(): never {
  throw new Error('audit_ledger_invalid_json');
}

function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function normalize(value: unknown, ancestors: WeakSet<object> = new WeakSet()): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : invalidJson();
  if (typeof value !== 'object') return invalidJson();

  if (ancestors.has(value)) return invalidJson();
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getOwnPropertySymbols(value).length > 0) return invalidJson();
      const ownNames = Object.getOwnPropertyNames(value);
      if (ownNames.length !== value.length + 1) return invalidJson();
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.prototype.hasOwnProperty.call(value, index)) return invalidJson();
      }
      return value.map((item) => normalize(item, ancestors));
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return invalidJson();
    if (Object.getOwnPropertySymbols(value).length > 0) return invalidJson();
    if (Object.getOwnPropertyNames(value).length !== Object.keys(value).length) return invalidJson();
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => compareCodeUnits(a, b))
        .map(([key, item]) => [key, normalize(item, ancestors)])
    );
  } finally {
    ancestors.delete(value);
  }
}

export function canonicalizeJson(value: unknown): string {
  return JSON.stringify(normalize(value));
}

export function assertBoundedMetadata(metadata: Record<string, unknown>): void {
  if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) invalidJson();
  const prototype = Object.getPrototypeOf(metadata);
  if (prototype !== Object.prototype && prototype !== null) invalidJson();

  const bytes = new TextEncoder().encode(canonicalizeJson(metadata)).byteLength;
  if (bytes > MAX_METADATA_BYTES) throw new Error('audit_ledger_metadata_too_large');
}
