import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkComputerOperationsPage } from '../../apps/web/src/work/WorkComputerOperationsPage';

vi.mock('../../apps/web/src/work/api', () => ({ listWorkRuntimes: async () => [] }));
vi.mock('../../apps/web/src/work/computerOperations', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../apps/web/src/work/computerOperations')>(),
  // The jsdom test host is not production; permit probes only in this fixture.
  browserProductionProbeSupported: () => true
}));

afterEach(() => vi.unstubAllGlobals());

describe('computer operations evidence flow', () => {
  it('captures real probe results, retains five reports, exports failures and clears on request', async () => {
    let status = 200;
    vi.stubGlobal('fetch', async () => new Response('', { status }));
    render(<MemoryRouter><WorkComputerOperationsPage /></MemoryRouter>);
    const history = screen.getByRole('region', { name: 'Diagnostic session evidence' });
    await within(history).findByRole('link', { name: 'Download report 1' });
    expect(within(history).getByText('passed')).toBeInTheDocument();

    status = 503;
    for (let run = 0; run < 5; run++) {
      fireEvent.click(screen.getByRole('button', { name: 'Check critical' }));
      await waitFor(() => expect(screen.getByRole('button', { name: 'Check critical' })).not.toBeDisabled());
    }
    expect(within(history).getAllByRole('link', { name: /Download report/ })).toHaveLength(5);
    const payload = within(history).getByRole('link', { name: 'Download report 1' }).getAttribute('href')!;
    const report = JSON.parse(decodeURIComponent(payload.split(',')[1]));
    expect(report.outcome).toBe('attention-required');
    expect(report.routes.every((route: { status: number }) => route.status === 503)).toBe(true);
    expect(report.productionVerified).toBe(false);
    fireEvent.click(within(history).getByRole('button', { name: 'Clear session history' }));
    expect(within(history).getByText('No completed checks in this session.')).toBeInTheDocument();
  });
});
