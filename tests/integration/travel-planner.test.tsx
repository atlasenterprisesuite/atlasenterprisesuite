import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TravelPlannerPage } from '../../apps/web/src/modules/travel/TravelPlannerPage';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function renderPlanner() {
  return render(<MemoryRouter><TravelPlannerPage /></MemoryRouter>);
}

function fillTrip() {
  fireEvent.change(screen.getByLabelText('Destino'), { target: { value: 'Orlando FL' } });
  fireEvent.change(screen.getByLabelText('Fecha de inicio'), { target: { value: '2026-11-10' } });
  fireEvent.change(screen.getByLabelText('Fecha final'), { target: { value: '2026-11-12' } });
}

describe('ATLAS Travel & Stay web planner', () => {
  it('blocks searching and calendar export until destination and travel dates are valid', () => {
    renderPlanner();
    expect(screen.getByRole('button', { name: /Buscar en la web/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Agendar plan/ })).toBeDisabled();
    fillTrip();
    expect(screen.getByRole('button', { name: /Buscar en la web/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Agendar plan/ })).toBeEnabled();
    expect(screen.getByText('2 noches')).toBeInTheDocument();
  });

  it('switches search category, opens an external search on user action and never claims an actual booking', () => {
    renderPlanner();
    fillTrip();
    fireEvent.click(screen.getByRole('button', { name: 'Autos de alquiler' }));
    expect(screen.getByRole('button', { name: 'Autos de alquiler' })).toHaveAttribute('aria-pressed', 'true');
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    fireEvent.click(screen.getByRole('button', { name: /Buscar en la web/ }));
    expect(open).toHaveBeenCalledWith(expect.stringContaining('https://www.google.com/search?q='), '_blank', 'noopener,noreferrer');
    expect(screen.getByText(/no reserva ni paga/)).toBeInTheDocument();
  });

  it('adds and removes user-provided travel options without fabricating a price', () => {
    renderPlanner();
    fillTrip();
    fireEvent.change(screen.getByLabelText('Nombre del alojamiento, vuelo o servicio'), { target: { value: 'Hotel ejemplo' } });
    fireEvent.change(screen.getByLabelText('Costo estimado (USD, opcional)'), { target: { value: '120' } });
    fireEvent.click(screen.getByRole('button', { name: 'Añadir opción pendiente' }));
    expect(screen.getByText('Hotel ejemplo')).toBeInTheDocument();
    expect(screen.getByText('Estimado: $120.00')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Quitar Hotel ejemplo' }));
    expect(screen.queryByText('Hotel ejemplo')).not.toBeInTheDocument();
    expect(screen.getByText(/Aún no has añadido opciones/)).toBeInTheDocument();
  });
});
