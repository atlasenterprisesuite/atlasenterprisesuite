import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DeviceConnectivityPanel } from '../../apps/web/src/modules/device-os/DeviceConnectivityPanel';
import { listLocalAgents, listLocalDevices } from '../../apps/web/src/modules/device-os/localControlApi';

vi.mock('../../apps/web/src/modules/device-os/localControlApi', () => ({
  listLocalAgents: vi.fn(),
  listLocalDevices: vi.fn()
}));

beforeEach(() => {
  vi.mocked(listLocalAgents).mockResolvedValue([]);
  vi.mocked(listLocalDevices).mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Device OS connectivity user interface', () => {
  it('shows an honest empty state without simulating iPhone or laptop connectivity', async () => {
    render(<DeviceConnectivityPanel />);
    expect(await screen.findByText(/No registered devices are reporting/)).toBeTruthy();
    expect(screen.getByText(/Browser origin has not been checked/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Check this browser → ATLAS' })).toBeTruthy();
  });

  it('renders enrolled device status without promoting its Internet or VPN to verified', async () => {
    vi.mocked(listLocalAgents).mockResolvedValue([{
      id: 'a1', org_id: 'org1', platform: 'win32', status: 'online',
      mtls_status: 'active', last_seen_at: new Date().toISOString()
    } as Awaited<ReturnType<typeof listLocalAgents>>[number]]);
    vi.mocked(listLocalDevices).mockResolvedValue([{
      id: 'd1', org_id: 'org1', agent_id: 'a1',
      label: 'My laptop', device_type: 'computer', health_status: 'healthy'
    } as Awaited<ReturnType<typeof listLocalDevices>>[number]]);
    render(<DeviceConnectivityPanel />);
    expect(await screen.findByText(/ATLAS control: Recent agent heartbeat/)).toBeTruthy();
    expect(screen.getByText('Internet: not measured · Wi-Fi: not measured')).toBeTruthy();
    expect(screen.getByText('Cellular: not measured · VPN: not measured')).toBeTruthy();
  });

  it('removes inventory after an authorization or API failure on refresh', async () => {
    render(<DeviceConnectivityPanel />);
    expect(await screen.findByText(/No registered devices are reporting/)).toBeTruthy();
    vi.mocked(listLocalAgents).mockRejectedValueOnce(new Error('permission_required'));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh registered devices' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Unable to verify registered devices'));
    expect(screen.queryByText(/No registered devices are reporting/)).toBeNull();
  });
});
