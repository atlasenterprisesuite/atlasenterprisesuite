import React from 'react';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { FuturisticEnterpriseHome, getAtlasCatalogShare } from '../../apps/web/src/components/FuturisticEnterpriseHome';
import { ATLAS_MODULES } from '../../apps/web/src/modules/registry';

describe('FuturisticEnterpriseHome visual landing', () => {
  it('renders the approved visual home with canonical quick access destinations', () => {
    render(
      <MemoryRouter>
        <FuturisticEnterpriseHome />
      </MemoryRouter>
    );

    expect(screen.getByRole('region', { name: 'ATLAS Enterprise Suite visual home' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'ATLAS Enterprise Suite' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'AI' })).toHaveAttribute('href', '/assistant');
    expect(screen.getByRole('link', { name: 'Enterprise' })).toHaveAttribute('href', '/suite');
    expect(screen.getByRole('link', { name: 'Finance' })).toHaveAttribute('href', '/finance');
    expect(screen.getByRole('link', { name: 'Network' })).toHaveAttribute('href', '/connect');
    expect(screen.getByRole('link', { name: 'Spatial' })).toHaveAttribute('href', '/galaxy');
  });

  it('renders registry-backed primary surfaces and truthful home status', () => {
    const implemented = ATLAS_MODULES.filter((module) => module.readiness === 'implemented').length;
    const gated = ATLAS_MODULES.filter((module) => module.readiness === 'external-gated').length;

    render(
      <MemoryRouter>
        <FuturisticEnterpriseHome />
      </MemoryRouter>
    );

    const primarySurfaces = screen.getByRole('navigation', { name: 'ATLAS primary surfaces' });
    expect(primarySurfaces).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'AI surface' })).toHaveAttribute('href', '/assistant');
    expect(screen.getByRole('link', { name: 'Enterprise surface' })).toHaveAttribute('href', '/suite');
    expect(screen.getByRole('link', { name: 'Finance surface' })).toHaveAttribute('href', '/finance');
    expect(screen.getByRole('link', { name: 'Network surface' })).toHaveAttribute('href', '/connect');
    expect(screen.getByRole('link', { name: 'Spatial surface' })).toHaveAttribute('href', '/galaxy');
    expect(screen.getByRole('link', { name: 'Health surface' })).toHaveAttribute('href', '/health');
    expect(screen.getByRole('link', { name: 'Business surface' })).toHaveAttribute('href', '/business');
    expect(screen.getByRole('link', { name: 'Creator surface' })).toHaveAttribute('href', '/studio');
    expect(screen.getByRole('link', { name: 'Cloud surface' })).toHaveAttribute('href', '/cloud');

    const status = screen.getByLabelText('ATLAS system status');
    expect(status).toHaveTextContent(`${implemented} implementados`);
    expect(status).toHaveTextContent(`${gated} conexiones`);
    expect(screen.getByText('IMPLEMENTADOS')).toBeInTheDocument();
    expect(screen.getByText('Cobertura de código en el catálogo; no es certificación de producción')).toBeInTheDocument();
    expect(screen.getByText('Capacidades con código registrado')).toBeInTheDocument();
    expect(screen.queryByText('Baseline operativo comprobado')).not.toBeInTheDocument();
    expect(screen.queryByText('Capacidades operativas')).not.toBeInTheDocument();
  });

  it('counts active evolution independently from operational readiness', () => {
    const activeEvolution = ATLAS_MODULES.filter((module) => module.evolution === 'active').length;
    expect(activeEvolution).toBeGreaterThan(0);

    render(
      <MemoryRouter>
        <FuturisticEnterpriseHome />
      </MemoryRouter>
    );

    const evolutionMetric = screen.getByText('EN EVOLUCIÓN').closest('article');
    expect(evolutionMetric).not.toBeNull();
    expect(evolutionMetric).toHaveTextContent(String(activeEvolution));
    expect(evolutionMetric).toHaveTextContent('Siguiente versión en desarrollo o validación');
  });

  it('exposes the technical dashboard as the dedicated ATLAS Command Center', () => {
    render(
      <MemoryRouter>
        <FuturisticEnterpriseHome />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: 'Abrir Command Center' })).toHaveAttribute('href', '#atlas-command-center');
    expect(screen.getByRole('region', { name: 'ATLAS Command Center' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'ATLAS module readiness summary' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Entrar a ATLAS' })).not.toBeInTheDocument();
  });

  it('routes command search to the first canonical matching module', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<FuturisticEnterpriseHome />} />
          <Route path="/finance" element={<div>Finance destination</div>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar en ATLAS' }), { target: { value: 'Finance' } });
    fireEvent.submit(screen.getByRole('form', { name: 'ATLAS command search' }));

    expect(screen.getByText('Finance destination')).toBeInTheDocument();
  });

  it('shows catalog distribution separately from production certification', () => {
    const implemented = ATLAS_MODULES.filter((module) => module.readiness === 'implemented').length;
    const evolving = ATLAS_MODULES.filter((module) => module.evolution === 'active').length;
    const gated = ATLAS_MODULES.filter((module) => module.readiness === 'external-gated').length;
    const total = ATLAS_MODULES.length;

    render(
      <MemoryRouter>
        <FuturisticEnterpriseHome />
      </MemoryRouter>
    );

    const chart = screen.getByRole('img', { name: /distribución del catálogo.*no es certificación/i });
    const bars = chart.querySelectorAll('.chart-bars > div > span');
    expect(bars).toHaveLength(3);
    const barLabels = chart.querySelectorAll('.chart-bars > div > small');
    expect(Array.from(barLabels, label => label.textContent)).toEqual([
      `${implemented} implementados`,
      `${evolving} en evolución`,
      `${gated} externos`
    ]);
    expect(bars[0]).toHaveStyle({ height: `${(implemented / total) * 100}%` });
    expect(bars[1]).toHaveStyle({ height: `${(evolving / total) * 100}%` });
    expect(bars[2]).toHaveStyle({ height: `${(gated / total) * 100}%` });
    expect(screen.getByText('Los estados pueden superponerse; no representan certificación de producción.')).toBeInTheDocument();
    expect(screen.getByText('Porcentaje de certificación: sin evidencia suficiente')).toBeInTheDocument();
  });

  it('uses accurate catalog percentage heights without a misleading minimum', () => {
    expect(getAtlasCatalogShare(0, 0)).toBe(0);
    expect(getAtlasCatalogShare(1, 20)).toBe(5);
    expect(getAtlasCatalogShare(20, 20)).toBe(100);
    expect(getAtlasCatalogShare(40, 20)).toBe(100);
    expect(getAtlasCatalogShare(-2, 20)).toBe(0);
  });

  it('ships the approved sunset photograph as a local reusable optimized asset', () => {
    const imagePath = resolve(process.cwd(), 'apps/web/public/assets/atlas-home-sunset.jpeg');
    expect(existsSync(imagePath)).toBe(true);
    expect(statSync(imagePath).size).toBeGreaterThan(10_000);
  });
});
