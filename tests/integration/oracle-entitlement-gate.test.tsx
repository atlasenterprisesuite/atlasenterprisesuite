import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getOracleStatus = vi.fn();

vi.mock('../../apps/web/src/lib/oracleApi', () => ({
  getOracleStatus
}));

import { RequireOracleEntitlement } from '../../apps/web/src/modules/oracle/RequireOracleEntitlement';

describe('RequireOracleEntitlement', () => {
  beforeEach(() => getOracleStatus.mockReset());

  it('shows private content only for the entitled account', async () => {
    getOracleStatus.mockResolvedValue({ ok: true, entitled: true, deck: null });
    render(<RequireOracleEntitlement><div>Private Oracle</div></RequireOracleEntitlement>);
    expect(screen.getByText(/checking private oracle access/i)).toBeTruthy();
    expect(await screen.findByText('Private Oracle')).toBeTruthy();
  });

  it('does not leak route contents to a non-entitled account', async () => {
    getOracleStatus.mockResolvedValue({ ok: true, entitled: false, deck: null });
    render(<RequireOracleEntitlement><div>Private Oracle</div></RequireOracleEntitlement>);
    await waitFor(() => expect(screen.getByText('This private ATLAS capability is not enabled for this account.')).toBeTruthy());
    expect(screen.queryByText('Private Oracle')).toBeNull();
  });

  it('shows a retryable error without rendering private content', async () => {
    getOracleStatus.mockRejectedValue(new Error('network_error'));
    render(<RequireOracleEntitlement><div>Private Oracle</div></RequireOracleEntitlement>);
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not verify private oracle access/i);
    expect(screen.queryByText('Private Oracle')).toBeNull();
  });
});
