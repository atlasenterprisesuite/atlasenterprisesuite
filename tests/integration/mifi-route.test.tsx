import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../apps/web/src/App';
import { MifiControlPage } from '../../apps/web/src/modules/telecom/MifiControlPage';
import type { CallForwardingRequest, MifiAdapter, MifiDevice } from '../../packages/telecom/src';

describe('ATLAS Telecom MiFi route', () => {
  it('renders MiFi controls inside the shared ATLAS shell without false live state', async () => {
    render(<MemoryRouter initialEntries={['/telecom/devices/mifi']}><App /></MemoryRouter>);

    expect(screen.getByRole('navigation', { name: 'ATLAS modules' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Telecom' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'MiFi Control' })).toBeInTheDocument();
    expect(screen.getByText(/No authorized MiFi device adapter is connected/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Activate forwarding' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Verify forwarding' })).toBeDisabled();
    expect(screen.queryByText(/^Connected$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Verified$/)).not.toBeInTheDocument();
  });

  it('exposes accessible MiFi form labels and safe disabled actions', async () => {
    render(<MemoryRouter initialEntries={['/telecom/devices/mifi']}><App /></MemoryRouter>);
    await screen.findByRole('heading', { name: 'MiFi Control' });
    expect(screen.getByLabelText('Device name')).toBeInTheDocument();
    expect(screen.getByLabelText('Carrier')).toBeInTheDocument();
    expect(screen.getByLabelText('MiFi line')).toBeInTheDocument();
    expect(screen.getByLabelText('Forward calls to')).toBeInTheDocument();
    expect(screen.getByLabelText('Forwarding mode')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Disable forwarding' })).toBeDisabled();
  });

  it('executes and verifies forwarding only through an authorized adapter', async () => {
    const scope = { tenantId: 'tenant-demo', organizationId: 'org-demo' };
    const connectedDevice: MifiDevice = {
      id: 'primary-mifi',
      scope,
      displayName: 'Test MiFi',
      carrierName: 'Test Carrier',
      lineNumber: null,
      connectionState: 'connected',
      capabilities: {
        callForwarding: true,
        callForwardingReasons: ['all'],
        sms: false,
        ussd: false,
        atCommands: true,
        qmi: false,
        mbim: false
      }
    };
    const setCallForwarding = vi.fn(async (_request: CallForwardingRequest) => ({
      requestId: 'req-1',
      accepted: true,
      verified: false,
      networkMessage: 'Accepted',
      errorCode: null
    }));
    const adapter: MifiAdapter = {
      getDevice: async () => connectedDevice,
      getCallForwarding: async () => [],
      setCallForwarding,
      verifyCallForwarding: async () => [{
        enabled: true,
        reason: 'all',
        destinationE164: '+17865550123'
      }]
    };

    render(<MifiControlPage adapter={adapter} writeAuthorized />);
    await screen.findByText('connected');
    fireEvent.change(screen.getByLabelText('Forward calls to'), { target: { value: '7865550123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Activate forwarding' }));

    await waitFor(() => expect(setCallForwarding).toHaveBeenCalledTimes(1));
    expect(setCallForwarding.mock.calls[0][0].rule.destinationE164).toBe('+17865550123');
    expect(screen.getByText(/accepted/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Verify forwarding' }));
    expect(await screen.findByText('Verified')).toBeInTheDocument();
  });
});
