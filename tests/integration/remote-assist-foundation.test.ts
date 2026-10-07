import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const deviceOs = readFileSync('apps/web/src/modules/device-os/DeviceOSPage.tsx', 'utf8');
const remoteAssist = readFileSync('apps/web/src/modules/device-os/RemoteAssistPanel.tsx', 'utf8');

describe('ATLAS Remote Assist foundation', () => {
  it('is surfaced inside the existing Device OS instead of a duplicate module', () => {
    expect(deviceOs).toContain("import { RemoteAssistPanel } from './RemoteAssistPanel'");
    expect(deviceOs).toContain('<RemoteAssistPanel />');
  });

  it('fails closed until real agent, mTLS and native desktop capabilities exist', () => {
    expect(remoteAssist).toContain("agent.status === 'online'");
    expect(remoteAssist).toContain("agent.mtls_status === 'active'");
    expect(remoteAssist).toContain("'remote.desktop.view'");
    expect(remoteAssist).toContain("'remote.desktop.control'");
    expect(remoteAssist).toContain('Native adapter required');
    expect(remoteAssist).toContain('will not simulate or falsely label unattended desktop control as active');
  });

  it('reuses the current browser operator as the executable remote automation path', () => {
    expect(remoteAssist).toContain("device.adapter === 'browser-cdp'");
    expect(remoteAssist).toContain("device.capabilities.includes('browser.control')");
    expect(remoteAssist).toContain('Current executable capability');
  });

  it('keeps Microsoft Quick Assist outside the ATLAS trust boundary', () => {
    expect(remoteAssist).toContain('Microsoft Quick Assist remains a manual, user-approved fallback outside the ATLAS control plane');
    expect(remoteAssist).not.toMatch(/quickassist\.exe|ms-quick-assist:/i);
  });
});
