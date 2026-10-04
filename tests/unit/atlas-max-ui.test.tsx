import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AtlasMaxPage } from '../../apps/web/src/modules/atlas-max/AtlasMaxPage';

afterEach(cleanup);

describe('ATLAS MAX experience', () => {
  it('renders three comparable tiers and emphasizes MAX', () => {
    render(<AtlasMaxPage entitlement={{ status: 'unknown' }} usage={{ used: 0, limit: 0 }} />);
    expect(screen.getByText('ATLAS Core')).toBeInTheDocument();
    expect(screen.getByText('ATLAS Pro')).toBeInTheDocument();
    expect(screen.getByText('ATLAS MAX')).toBeInTheDocument();
    expect(screen.getByTestId('atlas-max-plan')).toHaveAttribute('aria-current', 'true');
  });

  it('does not render MAX active from client presentation alone', () => {
    render(<AtlasMaxPage entitlement={{ status: 'unknown' }} usage={{ used: 0, limit: 0 }} />);
    expect(screen.queryByText(/MAX active/i)).not.toBeInTheDocument();
    expect(screen.getByText(/status unavailable/i)).toBeInTheDocument();
  });

  it('renders degraded evidence honestly', () => {
    render(<AtlasMaxPage entitlement={{ status: 'degraded', reason: 'metering_unavailable' }} usage={{ used: 0, limit: 0 }} />);
    expect(screen.getByRole('status')).toHaveTextContent(/degraded/i);
  });
});
