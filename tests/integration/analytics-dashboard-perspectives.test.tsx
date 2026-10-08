import React from 'react';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { AnalyticsRoutes } from '../../apps/web/src/modules/analytics/AnalyticsRoutes';

function renderAnalytics(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AnalyticsRoutes />
    </MemoryRouter>
  );
}

describe('ATLAS Analytics dashboard perspectives', () => {
  it('offers canonical executive, operations, and finance dashboard routes', () => {
    renderAnalytics('/analytics');
    const dashboards = screen.getByRole('navigation', { name: 'Dashboard perspectives' });
    for (const [label, href] of [
      ['Executive', '/analytics/executive'],
      ['Operations', '/analytics/operations'],
      ['Finance', '/analytics/finance']
    ]) {
      expect(within(dashboards).getByRole('link', { name: label })).toHaveAttribute('href', href);
    }
  });

  it.each([
    ['/analytics/executive', 'Executive dashboard'],
    ['/analytics/operations', 'Operations dashboard'],
    ['/analytics/finance', 'Finance dashboard']
  ])('shows %s without invented business data', (path, heading) => {
    renderAnalytics(path);
    expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument();
    expect(screen.getAllByLabelText('Metric value unavailable').length).toBeGreaterThan(0);
    expect(screen.getByText(/Values appear only after authorized, verified data is available/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Review source gates' })).toHaveAttribute('href', '/analytics/sources');
  });

  it('keeps dashboard navigation keyboard-accessible and route-aware', () => {
    renderAnalytics('/analytics/finance');
    const dashboards = screen.getByRole('navigation', { name: 'Dashboard perspectives' });
    expect(within(dashboards).getByRole('link', { name: 'Finance' })).toHaveAttribute('aria-current', 'page');
    expect(within(dashboards).getByRole('link', { name: 'Executive' })).not.toHaveAttribute('aria-current');
  });
});
