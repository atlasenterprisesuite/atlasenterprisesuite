import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RoutePlanningPage } from '../../apps/web/src/modules/ride/RoutePlanningPage';
import { calculateGpsRoute } from '../../apps/web/src/modules/gps/gpsApi';
vi.mock('../../apps/web/src/modules/gps/gpsApi', () => ({ calculateGpsRoute: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
function open() { render(<MemoryRouter><RoutePlanningPage /></MemoryRouter>); }
function enter(value = 'Inicio;0;0\nLejos;0;3\nCerca;0;1\nFinal;0;4') {
  fireEvent.change(screen.getByRole('textbox'), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: 'Ordenar paradas' }));
}
describe('Ride pilot interactions', () => {
  it('plans locally, exposes limits and invalidates old results when points change', () => {
    open(); enter();
    expect(screen.getAllByRole('listitem').map(n => n.textContent)).toEqual(['Inicio', 'Cerca', 'Lejos', 'Final']);
    expect(calculateGpsRoute).not.toHaveBeenCalled();
    expect(screen.getByText(/Google Route Optimization no está conectado/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'invalid' } });
    expect(screen.queryByRole('heading', { name: 'Orden propuesto' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ordenar paradas' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
  it('requests road legs in planned order only on explicit action', async () => {
    vi.mocked(calculateGpsRoute).mockResolvedValue({ ok: true, source: 'osrm', profile: 'driving', routes: [{ id: 'r', distance_m: 1000, duration_s: 120, geometry: { type: 'LineString', coordinates: [] }, steps: [] }] });
    open(); enter();
    fireEvent.click(screen.getByRole('button', { name: 'Consultar distancia vial' }));
    await waitFor(() => expect(screen.getByText(/Ruta vial consultada/)).toBeInTheDocument());
    expect(calculateGpsRoute).toHaveBeenCalledTimes(3);
    expect(vi.mocked(calculateGpsRoute).mock.calls[0][1].label).toBe('Cerca');
  });
  it('keeps the independent plan and discards partial road results on failure', async () => {
    vi.mocked(calculateGpsRoute).mockRejectedValue(new Error('unavailable'));
    open(); enter();
    fireEvent.click(screen.getByRole('button', { name: 'Consultar distancia vial' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'Orden propuesto' })).toBeInTheDocument();
    expect(screen.queryByText(/Ruta vial consultada/)).toBeNull();
  });
});
