import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AtlasMaxJourneys } from '../../apps/web/src/modules/atlas-max/AtlasMaxJourneys';
import { GatewayPanel } from '../../apps/web/src/modules/atlas-max/GatewayPanel';

afterEach(cleanup);

describe('ATLAS MAX customer journeys', () => {
  it('opens existing Finance route without performing operations', () => {
    render(<AtlasMaxJourneys />);
    expect(screen.getByRole('link', { name: /open finance workspace/i })).toHaveAttribute('href', '/finance');
    expect(screen.getByRole('button', { name: /finance operations/i })).toHaveAttribute('aria-pressed', 'true');
  });

  it('switches journeys through a real accessible control', () => {
    render(<AtlasMaxJourneys />);
    fireEvent.click(screen.getByRole('button', { name: /creative production/i }));
    expect(screen.getByRole('link', { name: /open ATLAS Studio/i })).toHaveAttribute('href', '/studio');
    expect(screen.getByRole('button', { name: /creative production/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /finance operations/i })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('ATLAS MAX real gateway presentation', () => {
  it('never fakes model readiness or request metrics when source is unavailable', () => {
    render(<GatewayPanel gateway={{ state: 'unavailable', verifiedProviders: [], requests: null, usageScope: null, checkedAt: null }} />);
    expect(screen.getByText(/No verified readiness can be displayed/i)).toBeInTheDocument();
    expect(screen.queryByText(/Authenticated snapshot/i)).not.toBeInTheDocument();
  });

  it('shows verified provider IDs and labeled request scope but no MAX subscription', () => {
    render(<GatewayPanel gateway={{
      state: 'ready', verifiedProviders: ['atlas-local'], requests: 12,
      usageScope: 'organization', checkedAt: '2026-11-06T05:00:00.000Z'
    }} />);
    expect(screen.getByText('atlas-local')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText(/Organization-scope history, not MAX quota/i)).toBeInTheDocument();
    expect(screen.queryByText(/MAX entitlement verified/i)).not.toBeInTheDocument();
  });
});
