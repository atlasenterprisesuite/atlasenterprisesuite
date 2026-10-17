import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { captureWebRuntime } from '../../apps/web/src/mobile/runtime';

const clientSource = readFileSync('apps/web/src/mobile/client.ts', 'utf8');
const hookSource = readFileSync('apps/web/src/mobile/useMobileRuntime.ts', 'utf8');

describe('ATLAS mobile web runtime', () => {
  it('keeps iPhone Safari classified as web while identifying phone form factor', () => {
    const snapshot = captureWebRuntime({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
      innerWidth: 390,
      maxTouchPoints: 5,
      language: 'en-US'
    });

    expect(snapshot.runtime).toBe('web');
    expect(snapshot.runtimeSource).toBe('browser');
    expect(snapshot.deviceClass).toBe('phone');
    expect(snapshot.osFamily).toBe('ios');
  });

  it('detects iPad-like Safari as a tablet web runtime without claiming ipad_native', () => {
    const snapshot = captureWebRuntime({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15',
      innerWidth: 1024,
      maxTouchPoints: 5,
      language: 'en-US'
    });

    expect(snapshot.runtime).toBe('web');
    expect(snapshot.deviceClass).toBe('tablet');
    expect(snapshot.osFamily).toBe('ipados');
  });

  it('marks absent browser APIs as unsupported instead of ready', () => {
    const snapshot = captureWebRuntime({
      userAgent: 'Mozilla/5.0',
      innerWidth: 375,
      maxTouchPoints: 0,
      language: 'en-US',
      mediaDevicesAvailable: false,
      permissionsApiAvailable: false,
      notificationsApiAvailable: false
    });

    expect(snapshot.capabilities.microphone).toBe('unsupported');
    expect(snapshot.capabilities.permissions).toBe('unsupported');
    expect(snapshot.capabilities.notifications).toBe('unsupported');
  });
});

describe('ATLAS mobile gateway client', () => {
  it('uses the canonical authenticated fetch and active organization scope', () => {
    expect(clientSource).toContain("authorizedAtlasFetch('/functions/v1/atlas-mobile?api=status'");
    expect(clientSource).toContain('getActiveAtlasOrganization');
    expect(clientSource).toContain("'x-atlas-org-id': organization.id");
  });

  it('fails closed on malformed gateway responses', () => {
    expect(clientSource).toContain("throw new Error('mobile_status_invalid_response')");
    expect(clientSource).toContain("state: 'unverified'");
  });

  it('keeps loading, error and stale server state explicit in the hook', () => {
    expect(hookSource).toContain("status: 'loading'");
    expect(hookSource).toContain("status: 'ready'");
    expect(hookSource).toContain("status: 'error'");
    expect(hookSource).toContain('stale');
    expect(hookSource).toContain('captureWebRuntime');
    expect(hookSource).toContain('getMobileStatus');
  });
});
