function invalidApprovalJson(): never {
  throw new Error('execution_approval_invalid_json');
}

function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function sortValue(value: unknown, ancestors: WeakSet<object> = new WeakSet()): unknown {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : invalidApprovalJson();
  if (typeof value !== 'object') return invalidApprovalJson();

  if (ancestors.has(value)) return invalidApprovalJson();
  ancestors.add(value);
  try {
    if (Array.isArray(value)) return value.map((item) => sortValue(item, ancestors));

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return invalidApprovalJson();
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => compareCodeUnits(a, b))
        .map(([key, item]) => [key, sortValue(item, ancestors)])
    );
  } finally {
    ancestors.delete(value);
  }
}

export function canonicalizeApprovalPayload(value: unknown) {
  return JSON.stringify(sortValue(value));
}

export async function digestApprovalPayload(value: unknown) {
  const bytes = new TextEncoder().encode(canonicalizeApprovalPayload(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((item) => item.toString(16).padStart(2, '0'))
    .join('');
}

export function approvalMatchesPayload(
  approval: { payloadVersion: number; payloadDigest: string; status: string },
  version: number,
  digest: string
) {
  return approval.status === 'approved'
    && approval.payloadVersion === version
    && approval.payloadDigest === digest;
}
