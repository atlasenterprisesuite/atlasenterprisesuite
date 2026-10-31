import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RoutePlanningPage } from '../../apps/web/src/modules/ride/RoutePlanningPage';
import { calculateGpsRoute } from '../../apps/web/src/modules/gps/gpsApi';
vi.mock('../../apps/web/src/modules/gps/gpsApi', () => ({ calculateGpsRoute: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
function open() { return render(<MemoryRouter><RoutePlanningPage /></MemoryRouter>); }
type RoadResponse = Awaited<ReturnType<typeof calculateGpsRoute>>;
function roadResponse(distance_m: number): RoadResponse {
  return { ok: true, source: 'test', profile: 'driving', routes: [{ id: 'r', distance_m, duration_s: 120, geometry: { type: 'LineString', coordinates: [] }, steps: [] }] };
}
function deferredRoad() {
  let resolve!: (response: RoadResponse) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<RoadResponse>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
function enter(value = 'Inicio;0;0\nLejos;0;3\nCerca;0;1\nFinal;0;4') {
  fireEvent.change(screen.getByRole('textbox'), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: 'Ordenar paradas' }));
}
describe('Ride pilot interactions', () => {
  it.each(['resolve', 'reject'] as const)('keeps a replacement query busy after a cancelled query settles (%s)', async outcome => {
    const cancelled = deferredRoad();
    const replacement = deferredRoad();
    vi.mocked(calculateGpsRoute).mockReturnValueOnce(cancelled.promise).mockReturnValueOnce(replacement.promise);
    open(); enter('Inicio;0;0\nFinal;0;4');
    fireEvent.click(screen.getByRole('button', { name: 'Consultar distancia vial' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar consulta vial' }));
    expect(screen.getByRole('textbox')).toBeEnabled();
    expect(screen.getByRole('heading', { name: 'Orden propuesto' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Consulta cancelada');
    fireEvent.click(screen.getByRole('button', { name: 'Consultar distancia vial' }));
    expect(calculateGpsRoute).toHaveBeenCalledTimes(2);
    await act(async () => {
      if (outcome === 'resolve') cancelled.resolve(roadResponse(999));
      else cancelled.reject(new Error('cancelled request failed late'));
    });
    expect(screen.getByRole('status')).toHaveTextContent('Calculando tramos');
    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/Ruta vial consultada/)).toBeNull();
    await act(async () => replacement.resolve(roadResponse(2000)));
    expect(screen.getByText(/Ruta vial consultada/)).toHaveTextContent('1.2 mi');
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('textbox')).toBeEnabled();
  });
  it('does not request another leg after the page unmounts during a route query', async () => {
    const firstLeg = deferredRoad();
    vi.mocked(calculateGpsRoute).mockReturnValueOnce(firstLeg.promise);
    const view = open(); enter();
    fireEvent.click(screen.getByRole('button', { name: 'Consultar distancia vial' }));
    expect(calculateGpsRoute).toHaveBeenCalledTimes(1);
    view.unmount();
    await act(async () => firstLeg.resolve(roadResponse(1000)));
    expect(calculateGpsRoute).toHaveBeenCalledTimes(1);
  });
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
