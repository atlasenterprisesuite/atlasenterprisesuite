// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../apps/web/src/App';
import {
  AtlasProvider,
  type AtlasIdentitySource,
  type AtlasIdentityState,
} from '../../apps/web/src/app/AtlasContext';
import { MifiControlPage } from '../../apps/web/src/modules/telecom/MifiControlPage';
import type { TenantScope } from '../../packages/core/src';
import type { CallForwardingRequest, MifiAdapter, MifiDevice } from '../../packages/telecom/src';

afterEach(cleanup);

function sourceFor(state: AtlasIdentityState): AtlasIdentitySource {
  return { resolve: async () => state };
}

const readyIdentity: AtlasIdentityState = {
  status: 'ready',
  userId: 'test-user-id',
  organizationId: 'test-organization-id',
  organizationName: 'Test Organization',
  role: 'admin',
  permissions: ['accounting.read', 'accounting.write', 'audit.read'],
};

function renderRoute() {
  return render(
    <MemoryRouter initialEntries={['/telecom/devices/mifi']}>
      <AtlasProvider source={sourceFor(readyIdentity)}>
        <App />
      </AtlasProvider>
    </MemoryRouter>,
  );
}

describe('ATLAS Telecom MiFi route', () => {
  it('renders inside the shared ATLAS shell without inventing live connectivity', async () => {
    renderRoute();

    expect(await screen.findByRole('heading', { name: 'MiFi Control' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'ATLAS modules' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Telecom' })).toBeInTheDocument();
    expect(screen.getByText(/No authorized MiFi device adapter is connected/)).toBeInTheDocument();
    expect(screen.getByText(/Telecom tenant scope is not configured/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Activate forwarding' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Verify forwarding' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Disable forwarding' })).toBeDisabled();
    expect(screen.queryByText(/^Connected$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Verified$/)).not.toBeInTheDocument();
  });

  it('exposes accessible MiFi form controls in the unavailable state', async () => {
    renderRoute();
    await screen.findByRole('heading', { name: 'MiFi Control' });

    expect(screen.getByLabelText('Device name')).toBeInTheDocument();
    expect(screen.getByLabelText('Carrier')).toBeInTheDocument();
    expect(screen.getByLabelText('MiFi line')).toBeInTheDocument();
    expect(screen.getByLabelText('Forward calls to')).toBeInTheDocument();
    expect(screen.getByLabelText('Forwarding mode')).toBeInTheDocument();
  });

  it('executes and verifies forwarding only when an explicit tenant scope and authorized adapter are supplied', async () => {
    const scope: TenantScope = { tenantId: 'tenant-test', organizationId: 'org-test' };
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
        mbim: false,
      },
    };
    const setCallForwarding = vi.fn(async (_request: CallForwardingRequest) => ({
      requestId: 'req-1',
      accepted: true,
      verified: false,
      networkMessage: 'Accepted',
      errorCode: null,
    }));
    const adapter: MifiAdapter = {
      getDevice: async () => connectedDevice,
      getCallForwarding: async () => [],
      setCallForwarding,
      verifyCallForwarding: async () => [{
        enabled: true,
        reason: 'all',
        destinationE164: '+17865550123',
      }],
    };

    render(<MifiControlPage adapter={adapter} scope={scope} writeAuthorized />);

    expect(await screen.findByText('connected')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Forward calls to'), { target: { value: '7865550123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Activate forwarding' }));

    await waitFor(() => expect(setCallForwarding).toHaveBeenCalledTimes(1));
    expect(setCallForwarding.mock.calls[0][0].scope).toEqual(scope);
    expect(setCallForwarding.mock.calls[0][0].rule.destinationE164).toBe('+17865550123');
    expect(await screen.findByText(/Command accepted/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Verify forwarding' }));
    expect(await screen.findByText('Verified')).toBeInTheDocument();
  });
});
