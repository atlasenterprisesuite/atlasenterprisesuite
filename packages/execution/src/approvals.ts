function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, sortValue(item)])
    );
  }
  return value;
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
