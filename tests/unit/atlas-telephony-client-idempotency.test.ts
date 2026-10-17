import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const apiSource = readFileSync('apps/web/src/lib/telephonyApi.ts', 'utf8');
const pageSource = readFileSync('apps/web/src/modules/connect/AtlasTelephonyPage.tsx', 'utf8');

describe('ATLAS telephony client idempotency', () => {
  it('requires the caller to send a stable idempotency key', () => {
    expect(apiSource).toContain('idempotencyKey: string');
    expect(apiSource).toContain('idempotency_key: input.idempotencyKey');
  });

  it('reuses one key for a retry and resets it when call inputs change', () => {
    expect(pageSource).toContain('useRef');
    expect(pageSource).toContain('callIdempotencyKeyRef');
    expect(pageSource).toContain('crypto.randomUUID()');
    expect(pageSource).toContain('idempotencyKey: callIdempotencyKeyRef.current');
    expect(pageSource).toContain('callIdempotencyKeyRef.current = null');
  });
});
