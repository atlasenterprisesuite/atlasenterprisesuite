import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../apps/web/src/modules/gps/gpsApi', () => ({
  searchGpsPlaces: vi.fn(async () => ({ ok: true, source: 'fixture', results: [
    { id: 'p', lat: 48.8566, lon: 2.3522, label: 'Paris', category: 'city', type: 'city', importance: 1, boundingbox: null },
    { id: 'c', lat: 30.0444, lon: 31.2357, label: 'Cairo', category: 'city', type: 'city', importance: 1, boundingbox: null }
  ] })),
  listGpsSavedPlaces: vi.fn(async () => ({ ok: true, places: [] })),
  calculateGpsRoute: vi.fn(),
  saveGpsPlace: vi.fn(),
  deleteGpsPlace: vi.fn()
}));
vi.mock('../../apps/web/src/modules/gps/Photorealistic3DView', () => ({ Photorealistic3DView: () => null }));
vi.mock('../../apps/web/src/modules/gps/IndoorNavigationPanel', () => ({ IndoorNavigationPanel: () => null }));
vi.mock('../../apps/web/src/modules/gps/CoverageControlPanel', () => ({ CoverageControlPanel: () => null }));

import { Gps4DPage } from '../../apps/web/src/modules/gps/Gps4DPage';

beforeEach(() => { window.history.replaceState(null, '', '/gps'); });
afterEach(() => { cleanup(); vi.clearAllMocks(); window.history.replaceState(null, '', '/gps'); });

describe('ATLAS Earth GPS 4D selected-point UI interaction', () => {
  it('does not expose external links until a user chooses a point', async () => {
    render(<Gps4DPage />);
    expect(screen.queryByRole('link', { name: /Google Maps \(servicio externo\)/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /Apple Maps \(servicio externo\)/ })).toBeNull();

    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar lugar' }), { target: { value: 'Paris' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar', exact: true }));
    const paris = await screen.findByRole('button', { name: /Paris/ });
    fireEvent.click(paris);

    const google = await screen.findByRole('link', { name: /Google Maps \(servicio externo\)/ });
    const apple = screen.getByRole('link', { name: /Apple Maps \(servicio externo\)/ });
    expect(new URL(google.getAttribute('href')!).searchParams.get('query')).toBe('48.8566,2.3522');
    expect(new URL(apple.getAttribute('href')!).searchParams.get('ll')).toBe('48.8566,2.3522');
    for (const link of [google, apple]) {
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });

  it('updates both outbound links after choosing a different destination', async () => {
    render(<Gps4DPage />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar lugar' }), { target: { value: 'Cairo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar', exact: true }));
    fireEvent.click(await screen.findByRole('button', { name: /Cairo/ }));
    await waitFor(() => expect(screen.getByRole('link', { name: /Google Maps \(servicio externo\)/ }))
      .toHaveAttribute('href', expect.stringContaining('30.0444')));
    expect(new URL(screen.getByRole('link', { name: /Apple Maps \(servicio externo\)/ }).getAttribute('href')!)
      .searchParams.get('ll')).toBe('30.0444,31.2357');
  });
  it('accepts explicitly supplied zero coordinates but rejects an empty coordinate', async () => {
    window.history.replaceState(null, '', '/gps?lat=0&lon=0');
    const view = render(<Gps4DPage />);
    const google = await screen.findByRole('link', { name: /Google Maps \\(servicio externo\\)/ });
    expect(new URL(google.getAttribute('href')!).searchParams.get('query')).toBe('0,0');
    view.unmount();

    window.history.replaceState(null, '', '/gps?lat=&lon=0');
    render(<Gps4DPage />);
    expect(screen.queryByRole('link', { name: /Google Maps \\(servicio externo\\)/ })).toBeNull();
  });

});
