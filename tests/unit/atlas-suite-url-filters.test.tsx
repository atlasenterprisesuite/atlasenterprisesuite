import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AtlasSuitePage } from '../../apps/web/src/modules/integration/AtlasSuitePage';
import { ATLAS_MODULES } from '../../apps/web/src/modules/registry';

function openSuite(path: string) {
  render(<MemoryRouter initialEntries={[path]}><AtlasSuitePage /></MemoryRouter>);
  const directory = screen.getByLabelText('ATLAS A-Z modules');
  return { cards: () => directory.querySelectorAll('.suite-module-card') };
}

describe('ATLAS Suite query filters', () => {
  it('honors canonical readiness deep links without calling them production certified', () => {
    const { cards } = openSuite('/suite?readiness=external-gated');
    expect(cards()).toHaveLength(ATLAS_MODULES.filter(item => item.readiness === 'external-gated').length);
    expect(screen.getByRole('button', { name: 'External Gate' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText(/not verified production health or release readiness/i)).toBeInTheDocument();
  });

  it('filters active evolution independently from readiness', () => {
    const { cards } = openSuite('/suite?evolution=active');
    expect(cards()).toHaveLength(ATLAS_MODULES.filter(item => item.evolution === 'active').length);
    expect(screen.getByRole('button', { name: 'Active evolution' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Code integrated' }));
    expect(cards()).toHaveLength(ATLAS_MODULES.filter(item => item.evolution === 'active' && item.readiness === 'implemented').length);
  });

  it('ignores unsupported query filters safely', () => {
    const { cards } = openSuite('/suite?readiness=verified&eye=admin&evolution=completed');
    expect(cards()).toHaveLength(ATLAS_MODULES.length);
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
  });
});
