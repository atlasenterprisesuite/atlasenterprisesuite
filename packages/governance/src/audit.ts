const secretKey = /token|secret|password|api[_-]?key|authorization/i;

export function redactAuditPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactAuditPayload);
  if (value === null || typeof value !== 'object') return value;

  const output: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    output[key] = secretKey.test(key) ? '[REDACTED]' : redactAuditPayload(nested);
  }
  return output;
}
