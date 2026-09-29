import React from 'react';
import { readFileSync } from 'node:fs';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { PolarSubscriptionsPage, polarSubscriptionsInternals } from '../../apps/web/src/modules/commerce/PolarSubscriptionsPage';

const appSource = readFileSync('apps/web/src/App.tsx', 'utf8');

afterEach(cleanup);

describe('ATLAS Polar subscriptions', () => {
  it('renders the provider-hosted checkout with a truthful verification boundary', () => {
    render(<MemoryRouter initialEntries={['/subscriptions']}><PolarSubscriptionsPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Subscribe to ATLAS through Polar' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continue to secure Polar checkout' })).toHaveAttribute('href', '/checkout/polar');
    expect(screen.getByText(/returning from checkout is not proof of payment/i)).toBeInTheDocument();
  });

  it('never treats the browser return as verified payment', () => {
    render(<MemoryRouter initialEntries={['/subscriptions/return?status=success']}><PolarSubscriptionsPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Payment verification pending' })).toBeInTheDocument();
    expect(screen.getByText(/has not marked the subscription active/i)).toBeInTheDocument();
  });

  it('normalizes only supported return states', () => {
    expect(polarSubscriptionsInternals.resolveState('success')).toBe('pending_verification');
    expect(polarSubscriptionsInternals.resolveState('canceled')).toBe('canceled');
    expect(polarSubscriptionsInternals.resolveState('paid')).toBe('ready');
  });

  it('keeps the worker redirect locked to the supplied Polar checkout', () => {
    const worker = readFileSync('worker/index.ts', 'utf8');
    expect(worker).toContain('polar_c_7Uw8jpDTb0EGlA6ru00ihSm9t4WXxEiueEzRJ2G9hnX');
    expect(worker).toContain("target.hostname !== 'polar.sh'");
    expect(worker).toContain("target.pathname.startsWith('/checkout/')");
    expect(worker).toContain("url.pathname === '/checkout/polar'");
    expect(worker).toContain('status: 303');
  });

  it('makes the subscription flow discoverable from the canonical home route', () => {
    expect(appSource).toContain('to="/pricing"');
    expect(appSource).toContain('<strong>ATLAS Plans</strong>');
  });
});
