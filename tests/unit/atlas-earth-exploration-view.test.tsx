import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { EarthExplorationPage } from '../../apps/web/src/modules/knowledge/EarthExplorationPage';

const view = () => render(<MemoryRouter><EarthExplorationPage /></MemoryRouter>);

describe('ATLAS Earth Exploration — evidence-first viewer behavior', () => {
  it('renders official remote map attribution and never claims archaeological verification', () => {
    view();
    const map = screen.getByRole('img', { name: /GEBCO_2026/i });
    expect(map).toHaveAttribute('src', expect.stringContaining('wms.gebco.net/mapserv'));
    expect(screen.getByRole('note')).toHaveTextContent(/no prueban la presencia de ciudades/i);
    expect(screen.getByText(/BedMachine Antarctica v3/i)).toBeInTheDocument();
    expect(screen.queryByText(/No se pudo cargar/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Volver a Knowledge Atlas/i })).toHaveAttribute('href', '/knowledge');
  });

  it('does not claim successful imagery after the provider fails, and recovers on layer selection', () => {
    view();
    const map = screen.getByRole('img', { name: /GEBCO_2026/i });
    fireEvent.error(map);
    expect(screen.getByRole('alert')).toHaveTextContent(/No se pudo cargar el WMS externo/i);
    expect(map).toHaveStyle({ display: 'none' });

    fireEvent.change(screen.getByLabelText(/Capa geográfica/i), { target: { value: 'tid' } });
    const updatedMap = screen.getByRole('img', { name: /Tipo de datos: TID/i });
    expect(updatedMap).toHaveAttribute('src', expect.stringContaining('gebco_latest_tid_2'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.load(updatedMap);
    expect(screen.getByRole('status')).toHaveTextContent(/Imagen recibida del servidor GEBCO/i);
  });

  it('shows a clear legend for direct, indirect and unknown source types only when TID layer is active', () => {
    view();
    expect(screen.queryByText(/Códigos TID y procedencia/i)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Capa geográfica/i), { target: { value: 'tid' } });
    expect(screen.getByText(/Códigos TID y procedencia/i)).toBeInTheDocument();
    expect(screen.getByText(/Multihaz/i)).toBeInTheDocument();
    expect(screen.getByText(/Predicción por gravedad satelital/i)).toBeInTheDocument();
    expect(screen.getByText(/Fuente desconocida/i)).toBeInTheDocument();
    expect(screen.getByText(/un código de origen no determina la certeza/i)).toBeInTheDocument();
  });
});
