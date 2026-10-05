import React from 'react';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { FuturisticEnterpriseHome } from '../../apps/web/src/components/FuturisticEnterpriseHome';

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
    expect(screen.getByRole('link', { name: 'Entrar a ATLAS' })).toHaveAttribute('href', '#atlas-dashboard');
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

  it('ships the approved sunset photograph as a local reusable optimized asset', () => {
    const imagePath = resolve(process.cwd(), 'apps/web/public/assets/atlas-home-sunset.webp');
    expect(existsSync(imagePath)).toBe(true);
    expect(statSync(imagePath).size).toBeGreaterThan(20_000);
  });
});
