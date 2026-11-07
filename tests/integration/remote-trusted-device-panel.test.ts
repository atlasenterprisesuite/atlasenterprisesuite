import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const panel = readFileSync('apps/web/src/modules/device-os/RemoteAssistPanel.tsx', 'utf8');
const policy = readFileSync('apps/web/src/modules/device-os/remoteTrustedDeviceDiscovery.ts', 'utf8');

describe('ATLAS Trusted Devices integration contract', () => {
  it('reuses canonical authenticated Local Agent list and shows a real refresh action', () => {
    expect(panel).toContain('Discover my ATLAS devices');
    expect(panel).toContain('requestRefresh((value) => value + 1)');
    expect(panel).toContain('listLocalAgents()');
    expect(panel).toContain('listLocalDevices()');
    expect(panel).toContain('discoverRecognizedHosts(');
  });
  it('does not silently open remote access or trust shared ChatGPT credentials', () => {
    expect(panel).toContain('Remote control not authorized');
    expect(panel).not.toContain('remote.desktop.control\'', 0);
    expect(policy).toContain('remoteSessionAuthorized: false');
    expect(policy).not.toContain('localStorage');
    expect(policy).not.toContain('document.cookie');
    expect(policy).not.toContain('chatgpt.com');
  });
});
