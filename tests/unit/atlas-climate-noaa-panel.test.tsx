import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClimateNoaaPanel } from '../../apps/web/src/modules/city/ClimateNoaaPanel';
import { readAtlasClimateNoaaAlerts } from '../../apps/web/src/modules/city/climateNoaaApi';
import type { UrbanTwinEntity } from '../../apps/web/src/modules/city/urbanTwinRepository';
import type { AtlasClimateNoaaResponse } from '../../apps/web/src/modules/city/climateNoaaApi';

vi.mock('../../apps/web/src/modules/city/climateNoaaApi', () => ({
  readAtlasClimateNoaaAlerts: vi.fn()
}));

const verified: UrbanTwinEntity = {
  id: 'verified-location',
  parent_id: null,
  entity_type: 'building',
  name: 'Verified campus',
  external_ref: null,
  source_kind: 'manual',
  lifecycle_state: 'active',
  verification_state: 'verified',
  latitude: 28.5,
  longitude: -81.3,
  last_verified_at: '2026-11-25T10:00:00Z',
  updated_at: '2026-11-25T10:00:00Z'
};
const pending = { ...verified, id: 'pending-location', name: 'Unverified facility', verification_state: 'unverified' as const };
const noPosition = { ...verified, id: 'unknown-location', name: 'Missing coordinates', latitude: null, longitude: null };
const retired = { ...verified, id: 'retired-site', name: 'Retired facility', lifecycle_state: 'retired' };
const data = (status: 'complete' | 'partial' = 'complete'): AtlasClimateNoaaResponse => ({
  ok: true,
  domain: 'climate',
  source: 'NOAA/NWS',
  status,
  fetchedAt: '2026-11-26T14:00:00Z',
  requestedPoint: { latitude: 28.5, longitude: -81.3 },
  providerCount: status === 'partial' ? 1 : 0,
  rejectedCount: status === 'partial' ? 1 : 0,
  unprocessedCount: 0,
  truncated: false,
  mayPublishAlert: false,
  alerts: []
});

const mockedRead = vi.mocked(readAtlasClimateNoaaAlerts);
beforeEach(() => mockedRead.mockReset());
afterEach(cleanup);

describe('ATLAS climate NOAA panel — user-directed and truthful', () => {
  it('does not fetch or request device geolocation on render', () => {
    render(<ClimateNoaaPanel entities={[verified, pending, noPosition, retired]} />);
    expect(mockedRead).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /consult NOAA/i })).toBeDisabled();
    expect(screen.getByRole('option', { name: 'Verified campus' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Unverified facility' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Missing coordinates' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Retired facility' })).not.toBeInTheDocument();
  });

  it('shows a constrained no-alerts result only after an explicit click', async () => {
    mockedRead.mockResolvedValueOnce(data());
    render(<ClimateNoaaPanel entities={[verified]} />);
    fireEvent.change(screen.getByRole('combobox', { name: /site to check/i }), {
      target: { value: 'verified-location' }
    });
    fireEvent.click(screen.getByRole('button', { name: /consult NOAA/i }));
    expect(mockedRead).toHaveBeenCalledWith('verified-location');
    expect(await screen.findByText(/No active NWS alerts were returned/i)).toBeInTheDocument();
    expect(screen.getByText(/not proof that an area is safe/i)).toBeInTheDocument();
  });

  it('never describes a partial or rejected provider response as clear conditions', async () => {
    mockedRead.mockResolvedValueOnce(data('partial'));
    render(<ClimateNoaaPanel entities={[verified]} />);
    fireEvent.change(screen.getByRole('combobox', { name: /site to check/i }), {
      target: { value: 'verified-location' }
    });
    fireEvent.click(screen.getByRole('button', { name: /consult NOAA/i }));
    expect(await screen.findByText(/Incomplete NOAA result/i)).toBeInTheDocument();
    expect(screen.queryByText(/No active NWS alerts were returned/i)).not.toBeInTheDocument();
  });

  it('does not interpret a provider failure as no alerts', async () => {
    mockedRead.mockRejectedValueOnce(new Error('climate_gate_unavailable'));
    render(<ClimateNoaaPanel entities={[verified]} />);
    fireEvent.change(screen.getByRole('combobox', { name: /site to check/i }), {
      target: { value: 'verified-location' }
    });
    fireEvent.click(screen.getByRole('button', { name: /consult NOAA/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Unable to check the NOAA feed/i);
    expect(screen.queryByText(/No active NWS alerts were returned/i)).not.toBeInTheDocument();
  });

  it('cannot query without a verified entity with coordinates', () => {
    render(<ClimateNoaaPanel entities={[pending, noPosition]} />);
    expect(screen.getByRole('button', { name: /consult NOAA/i })).toBeDisabled();
    expect(screen.getByText(/No verified Urban Twin locations with coordinates/i)).toBeInTheDocument();
    expect(mockedRead).not.toHaveBeenCalled();
  });
});
