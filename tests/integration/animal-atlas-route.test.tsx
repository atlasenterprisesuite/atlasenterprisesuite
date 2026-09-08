import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../../apps/web/src/App';

function renderApp(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
}

describe('ATLAS Knowledge Atlas Animal Kingdom routes', () => {
  beforeEach(() => window.localStorage.clear());

  it('renders the evidence-backed Animal Kingdom catalog and truthful source state', async () => {
    renderApp('/knowledge/animals');
    expect(await screen.findByRole('heading', { name: 'Animal Kingdom' })).toBeInTheDocument();
    expect(await screen.findByText('Plecia nearctica')).toBeInTheDocument();
    expect(screen.getByText(/Repository-curated evidence/i)).toBeInTheDocument();
    expect(screen.getAllByText(/10 records/i).length).toBeGreaterThan(0);
  });

  it('searches and filters the loaded animal records', async () => {
    renderApp('/knowledge/animals');
    await screen.findByText('Plecia nearctica');

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search animals' }), { target: { value: 'alligator' } });
    expect(screen.getByText('Alligator mississippiensis')).toBeInTheDocument();
    expect(screen.queryByText('Plecia nearctica')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Animal group'), { target: { value: 'Reptiles' } });
    expect(screen.getByText('Alligator mississippiensis')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search animals' }), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Ecological role'), { target: { value: 'detritivore' } });
    expect(screen.getByText(/No animals match these filters/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Animal group'), { target: { value: '' } });
    expect(screen.getByText('Plecia nearctica')).toBeInTheDocument();
    expect(screen.getByText('Lumbricus terrestris')).toBeInTheDocument();
  });

  it('renders the lovebug detail with taxonomy, myth correction and real source links', async () => {
    renderApp('/knowledge/animals/common-lovebug');
    expect(await screen.findByRole('heading', { name: 'Common lovebug' })).toBeInTheDocument();
    expect(screen.getAllByText('Plecia nearctica').length).toBeGreaterThan(0);
    expect(screen.getByText('Bibionidae')).toBeInTheDocument();
    expect(screen.getByText(/created or engineered/i)).toBeInTheDocument();
    const evidence = screen.getByRole('region', { name: 'Evidence sources' });
    const ufLinks = within(evidence).getAllByRole('link', { name: /University of Florida IFAS Extension/i });
    expect(ufLinks.some((link) => link.getAttribute('href') === 'https://ask.ifas.ufl.edu/publication/IN204')).toBe(true);
  });

  it('wires Knowledge into the shared ATLAS navigation', async () => {
    renderApp('/knowledge/animals');
    await screen.findByRole('heading', { name: 'Animal Kingdom' });
    const nav = screen.getByRole('navigation', { name: 'ATLAS modules' });
    expect(within(nav).getByRole('link', { name: 'Knowledge' })).toHaveAttribute('href', '/knowledge/animals');
  });

  it('recovers to the catalog when an unknown animal slug is requested', async () => {
    renderApp('/knowledge/animals/not-a-real-record');
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Animal Kingdom' })).toBeInTheDocument());
  });
});
