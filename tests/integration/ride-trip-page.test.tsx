import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TripPlanningPage } from '../../apps/web/src/modules/ride/TripPlanningPage';
import { calculateGpsRoute, searchGpsPlaces } from '../../apps/web/src/modules/gps/gpsApi';

vi.mock('../../apps/web/src/modules/gps/gpsApi', () => ({ calculateGpsRoute: vi.fn(), searchGpsPlaces: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
function open() { render(<MemoryRouter><TripPlanningPage /></MemoryRouter>); }
async function select(label: string, name: string, lat: number) {
  vi.mocked(searchGpsPlaces).mockResolvedValue({ ok: true, source: 'test', results: [{ id: name, label: name, lat, lon: 0, category: '', type: '', importance: 1, boundingbox: null }] });
  fireEvent.change(screen.getByRole('textbox', { name: label }), { target: { value: name } });
  fireEvent.click(screen.getByRole('button', { name: `Buscar ${label.toLowerCase()}` }));
  fireEvent.click(await screen.findByRole('button', { name }));
}
const response = { ok: true as const, source: 'test', profile: 'driving' as const, routes: [{ id: 'r', distance_m: 1000, duration_s: 120, geometry: { type: 'LineString' as const, coordinates: [] }, steps: [] }] };

describe('Ride passenger trip preparation', () => {
  it('requires selected places, calculates ordered legs and invalidates the route when edited', async () => {
    open();
    expect(screen.getByRole('button', { name: 'Consultar recorrido' })).toBeDisabled();
    await select('Origen', 'Salida', 1);
    await select('Destino', 'Llegada', 3);
    fireEvent.click(screen.getByRole('button', { name: 'Agregar parada' }));
    await select('Parada 1', 'Visita', 2);
    vi.mocked(calculateGpsRoute).mockResolvedValue(response);
    fireEvent.click(screen.getByRole('button', { name: 'Consultar recorrido' }));
    await screen.findByRole('heading', { name: 'Tu recorrido' });
    expect(screen.getByText('1.2 mi')).toBeInTheDocument();
    expect(screen.getByText('4 min')).toBeInTheDocument();
    expect(vi.mocked(calculateGpsRoute).mock.calls.map(([a, b]) => [a.label, b.label])).toEqual([['Salida', 'Visita'], ['Visita', 'Llegada']]);
    expect(screen.getByRole('link', { name: 'Abrir destino en GPS 4D' })).toHaveAttribute('href', '/gps?lat=3&lon=0&label=Llegada');
    expect(screen.getByText(/Reserva y pago no disponibles/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Destino' }), { target: { value: 'Otro lugar' } });
    expect(screen.queryByRole('heading', { name: 'Tu recorrido' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Consultar recorrido' })).toBeDisabled();
  });
  it('rejects partial routes and permits retry without presenting a booked trip', async () => {
    open(); await select('Origen', 'Salida', 1); await select('Destino', 'Llegada', 3);
    vi.mocked(calculateGpsRoute).mockResolvedValue({ ...response, routes: [] });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar recorrido' }));
    await screen.findByRole('alert');
    expect(screen.queryByRole('heading', { name: 'Tu recorrido' })).toBeNull();
    vi.mocked(calculateGpsRoute).mockResolvedValue(response);
    fireEvent.click(screen.getByRole('button', { name: 'Consultar recorrido' }));
    await screen.findByRole('heading', { name: 'Tu recorrido' });
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('bounds stops and clears the itinerary', () => {
    open();
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole('button', { name: 'Agregar parada' }));
    expect(screen.getByRole('button', { name: 'Agregar parada' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar parada 2' }));
    expect(screen.getByRole('button', { name: 'Agregar parada' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar viaje' }));
    expect(screen.getAllByRole('textbox')).toHaveLength(2);
    expect(screen.getByRole('textbox', { name: 'Origen' })).toHaveValue('');
  });
  it('ignores results from a search whose input has changed', async () => {
    let finish!: (value: Awaited<ReturnType<typeof searchGpsPlaces>>) => void;
    vi.mocked(searchGpsPlaces).mockReturnValue(new Promise(resolve => { finish = resolve; }));
    open();
    fireEvent.change(screen.getByRole('textbox', { name: 'Origen' }), { target: { value: 'Anterior' } });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar origen' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Origen' }), { target: { value: 'Actual' } });
    await act(async () => finish({ ok: true, source: 'test', results: [{ id: 'old', label: 'Resultado anterior', lat: 1, lon: 0, category: '', type: '', importance: 1, boundingbox: null }] }));
    expect(screen.queryByRole('button', { name: 'Resultado anterior' })).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Origen' })).toHaveValue('Actual');
  });
  it('shows empty and failed search states without selecting an address', async () => {
    open();
    fireEvent.change(screen.getByRole('textbox', { name: 'Origen' }), { target: { value: 'Desconocido' } });
    vi.mocked(searchGpsPlaces).mockResolvedValue({ ok: true, source: 'test', results: [] });
    fireEvent.click(screen.getByRole('button', { name: 'Buscar origen' }));
    await screen.findByText(/No se encontraron lugares/);
    vi.mocked(searchGpsPlaces).mockRejectedValue(new Error('network'));
    fireEvent.click(screen.getByRole('button', { name: 'Buscar origen' }));
    await screen.findByText(/No se pudo buscar/);
    expect(screen.getByRole('button', { name: 'Consultar recorrido' })).toBeDisabled();
  });
  it('does not expose partial totals if a later stop fails', async () => {
    open(); await select('Origen', 'Salida', 1); await select('Destino', 'Llegada', 3);
    fireEvent.click(screen.getByRole('button', { name: 'Agregar parada' }));
    await select('Parada 1', 'Visita', 2);
    vi.mocked(calculateGpsRoute).mockResolvedValueOnce(response).mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(screen.getByRole('button', { name: 'Consultar recorrido' }));
    await screen.findByRole('alert');
    expect(screen.queryByRole('heading', { name: 'Tu recorrido' })).toBeNull();
    expect(screen.queryByText('0.6 mi')).toBeNull();
  });
  it.each([NaN, Infinity, -1])('rejects invalid route distances (%s)', async distance_m => {
    open(); await select('Origen', 'Salida', 1); await select('Destino', 'Llegada', 3);
    vi.mocked(calculateGpsRoute).mockResolvedValue({ ...response, routes: [{ ...response.routes[0], distance_m }] });
    fireEvent.click(screen.getByRole('button', { name: 'Consultar recorrido' }));
    await screen.findByRole('alert');
    expect(screen.queryByRole('heading', { name: 'Tu recorrido' })).toBeNull();
  });
});
