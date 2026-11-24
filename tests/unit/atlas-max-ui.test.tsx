import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { AtlasMaxPage } from '../../apps/web/src/modules/atlas-max/AtlasMaxPage';

afterEach(cleanup);

describe('ATLAS MAX client experience', () => {
  const unknown = { entitlement: { status: 'unknown' as const }, usage: { used: 0, limit: 0 } };

  it('shows the canonical product hierarchy and three comparable tiers without claiming a selected plan', () => {
    render(<AtlasMaxPage {...unknown} />);
    expect(screen.getByRole('heading', { level: 1, name: 'ATLAS MAX' })).toBeInTheDocument();
    expect(screen.getByText('ATLAS Core')).toBeInTheDocument();
    expect(screen.getByText('ATLAS Pro')).toBeInTheDocument();
    expect(screen.getAllByText('ATLAS MAX')).toHaveLength(2);
    const featured = screen.getByTestId('atlas-max-plan');
    expect(featured).toHaveAttribute('data-featured', 'true');
    expect(featured).not.toHaveAttribute('aria-current');
  });

  it('never presents unknown entitlement or metering as active or measured', () => {
    render(<AtlasMaxPage {...unknown} />);
    expect(screen.getByRole('status')).toHaveTextContent(/status unavailable/i);
    expect(screen.queryByText(/MAX active/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByText(/usage data unavailable/i)).toBeInTheDocument();
  });

  it('does not verify a subscription from status without evidence', () => {
    render(<AtlasMaxPage entitlement={{ status: 'allowed' }} usage={{ used: 10, limit: 100 }} />);
    expect(screen.getByRole('status')).toHaveTextContent(/evidence required/i);
    expect(screen.queryByText(/MAX entitlement verified/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('does not mark Pro as MAX from unrelated entitlement evidence', () => {
    render(<AtlasMaxPage entitlement={{ status: 'allowed', planId: 'pro', evidenceRef: 'entitlement:pro' }} usage={{ used: 4, limit: 10, evidenceRef: 'meter:verified' }} />);
    expect(screen.getByRole('status')).toHaveTextContent(/evidence required/i);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('discloses degraded state without inventing operational metrics', () => {
    render(<AtlasMaxPage entitlement={{ status: 'degraded', reason: 'metering_unavailable' }} usage={{ used: 0, limit: 0 }} />);
    expect(screen.getByRole('status')).toHaveTextContent(/degraded/i);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('shows a usage meter only with a source and valid values', () => {
    render(<AtlasMaxPage
      entitlement={{ status: 'allowed', planId: 'max', evidenceRef: 'entitlement:verified' }}
      usage={{ used: 20, limit: 100, evidenceRef: 'meter:verified' }}
    />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '20');
    expect(screen.getByRole('status')).toHaveTextContent(/MAX entitlement verified/i);
  });

  it('offers a real readiness navigation instead of an inert operator action', () => {
    render(<AtlasMaxPage {...unknown} />);
    expect(screen.getByRole('link', { name: /review execution readiness/i })).toHaveAttribute('href', '/execution/manager/readiness');
    expect(screen.queryByRole('button', { name: /create operator/i })).not.toBeInTheDocument();
  });
});
