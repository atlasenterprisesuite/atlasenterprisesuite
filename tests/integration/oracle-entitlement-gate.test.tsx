import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ getOracleStatus: vi.fn() }));

vi.mock('../../apps/web/src/lib/oracleApi', () => ({
  getOracleStatus: mocks.getOracleStatus
}));

import { RequireOracleEntitlement } from '../../apps/web/src/modules/oracle/RequireOracleEntitlement';

describe('RequireOracleEntitlement', () => {
  beforeEach(() => mocks.getOracleStatus.mockReset());

  it('shows private content only for the entitled account', async () => {
    mocks.getOracleStatus.mockResolvedValue({ ok: true, entitled: true, deck: null });
    render(<RequireOracleEntitlement><div>Private Oracle</div></RequireOracleEntitlement>);
    expect(screen.getByText(/checking private oracle access/i)).toBeTruthy();
    expect(await screen.findByText('Private Oracle')).toBeTruthy();
  });

  it('does not leak route contents to a non-entitled account', async () => {
    mocks.getOracleStatus.mockResolvedValue({ ok: true, entitled: false, deck: null });
    render(<RequireOracleEntitlement><div>Private Oracle</div></RequireOracleEntitlement>);
    await waitFor(() => expect(screen.getByText('This private ATLAS capability is not enabled for this account.')).toBeTruthy());
    expect(screen.queryByText('Private Oracle')).toBeNull();
  });

  it('shows a retryable error without rendering private content', async () => {
    let rejectStatus: (cause: Error) => void = () => undefined;
    mocks.getOracleStatus.mockImplementation(() => new Promise((_resolve, reject) => {
      rejectStatus = reject;
    }));
    render(<RequireOracleEntitlement><div>Private Oracle</div></RequireOracleEntitlement>);
    await act(async () => {
      rejectStatus(new Error('network_error'));
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not verify private oracle access/i);
    expect(screen.queryByText('Private Oracle')).toBeNull();
  });
});
