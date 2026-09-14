import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getOracleStatus = vi.fn();
const getOracleDeck = vi.fn();
const listOracleReadings = vi.fn();
const getOracleReading = vi.fn();
const createOracleReading = vi.fn();
const saveOracleNote = vi.fn();
const setOracleFavorite = vi.fn();

vi.mock('../../apps/web/src/lib/oracleApi', () => ({
  getOracleStatus,
  getOracleDeck,
  listOracleReadings,
  getOracleReading,
  createOracleReading,
  saveOracleNote,
  setOracleFavorite
}));

import { OracleRoutes } from '../../apps/web/src/modules/oracle/OracleRoutes';

function renderOracle(path = '/assistant/oracle') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/assistant/oracle/*" element={<OracleRoutes />} />
      </Routes>
    </MemoryRouter>
  );
}

const deck = {
  id: 'deck-1',
  slug: 'mensajes-oraculo-mistico',
  name: 'Mensajes del Oráculo Místico',
  expected_card_count: 44,
  verified_card_count: 7,
  is_complete: false
};

beforeEach(() => {
  vi.clearAllMocks();
  getOracleStatus.mockResolvedValue({ ok: true, entitled: true, deck });
  listOracleReadings.mockResolvedValue({ ok: true, readings: [] });
  getOracleDeck.mockResolvedValue({
    ok: true,
    deck,
    cards: [{ id: 'c1', slug: 'confia', title: 'CONFÍA', short_message: 'Confía.', long_message: 'Confía en el proceso.', category: 'trust', position: 1 }]
  });
  getOracleReading.mockResolvedValue({
    ok: true,
    reading: { id: 'r1', reading_type: 'daily', created_at: '2026-09-14T20:00:00Z' },
    cards: [{ card_id: 'c1', spread_position: 'energy', sequence: 0, oracle_cards: { id: 'c1', slug: 'confia', title: 'CONFÍA', short_message: 'Confía.', long_message: 'Confía en el proceso.', category: 'trust' } }],
    note: null,
    favorites: []
  });
});

describe('ATLAS Private Oracle routes', () => {
  it('renders the private Oracle home with all reading modes and truthful empty history', async () => {
    renderOracle();
    expect(await screen.findByRole('heading', { name: 'ATLAS Mystic Oracle' })).toBeInTheDocument();
    for (const label of ['Daily Reading', 'Love', 'Money', 'Work', 'Emotional reflection', 'Spiritual message', 'Full Reading']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
    expect(await screen.findByText('No private readings yet.')).toBeInTheDocument();
    expect(screen.getByText(/symbolic reflection/i)).toBeInTheDocument();
  });

  it('shows the verified deck as incomplete at seven of forty-four', async () => {
    renderOracle('/assistant/oracle/deck');
    expect(await screen.findByRole('heading', { name: 'Mystical Deck Library' })).toBeInTheDocument();
    expect(screen.getByText('7 verified of 44')).toBeInTheDocument();
    expect(screen.getByText('Deck incomplete')).toBeInTheDocument();
    expect(screen.getByText('CONFÍA')).toBeInTheDocument();
  });

  it('shows an owned persisted reading and private note control', async () => {
    renderOracle('/assistant/oracle/readings/r1');
    expect(await screen.findByRole('heading', { name: 'Your private reading' })).toBeInTheDocument();
    expect(screen.getByText('CONFÍA')).toBeInTheDocument();
    expect(screen.getByLabelText('Private note')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save private note' })).toBeInTheDocument();
  });

  it('never renders Oracle before the entitlement gate resolves', async () => {
    let resolveStatus: (value: unknown) => void = () => undefined;
    getOracleStatus.mockImplementation(() => new Promise((resolve) => { resolveStatus = resolve; }));
    renderOracle();
    expect(screen.getByText(/checking private oracle access/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'ATLAS Mystic Oracle' })).toBeNull();
    resolveStatus({ ok: true, entitled: true, deck });
    await waitFor(() => expect(screen.getByRole('heading', { name: 'ATLAS Mystic Oracle' })).toBeInTheDocument());
  });
});
