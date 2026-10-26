import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const panel = readFileSync(new URL('../../apps/web/src/modules/device-os/RemoteAssistPanel.tsx', import.meta.url), 'utf8');

describe('ATLAS Remote Assist fail-closed readiness', () => {
  it('does not label declared remote capabilities as evidence verified', () => {
    expect(panel).not.toContain("case 'ready': return 'Evidence verified'");
    expect(panel).not.toContain("setState('ready')");
  });
  it('blocks control until signed adapter and authorized session evidence exist', () => {
    expect(panel).toContain("setState('adapter-required')");
    expect(panel).toContain('signed native adapter and authorized session evidence are not verified');
  });
  it('does not enable access for a merely online agent without mTLS', () => {
    expect(panel).toContain("if (!secureWindowsAgents.length)");
    expect(panel).toContain("setState('secure-agent-required')");
  });
  it('does not allow access when no native adapter is registered', () => {
    expect(panel).toContain("if (!remoteDevices.length)");
    expect(panel).toContain("setState('adapter-required')");
  });
  it('does not claim revoked or cross-tenant sessions are safe without backend verification', () => {
    expect(panel).toContain('tenant scope, consent, session lifetime and revocation');
    expect(panel).not.toContain('Unattended access enabled');
  });
});
