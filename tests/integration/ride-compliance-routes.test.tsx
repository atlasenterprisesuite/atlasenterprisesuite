import React from 'react';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ComplianceHomePage } from '../../apps/web/src/modules/ride/ComplianceHomePage';
import { DocumentsPage } from '../../apps/web/src/modules/ride/DocumentsPage';
import { DriverHomePage } from '../../apps/web/src/modules/ride/DriverHomePage';
import { RideHomePage } from '../../apps/web/src/modules/ride/RideHomePage';

const root = process.cwd();
const moduleRoot = resolve(root, 'apps/web/src/modules/ride');
const routeSource = () => readFileSync(resolve(moduleRoot, 'RideRoutes.tsx'), 'utf8');

describe('ATLAS Ride compliance routes', () => {
  it('exposes every protected route in the approved hierarchy', () => {
    const source = routeSource();
    for (const route of [
      '/ride',
      '/ride/driver',
      '/ride/driver/compliance',
      '/ride/driver/compliance/documents',
      '/ride/driver/compliance/documents/profile-photo'
    ]) expect(source).toContain(`path="${route}"`);
    expect(source).toContain('AtlasShell');
    expect(source).toContain('RequireAtlasIdentity');
  });

  it('links Ride to Driver / Partner', () => {
    render(<MemoryRouter><RideHomePage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: /atlas ride/i })).toBeInTheDocument();
    const rideNav = screen.getByRole('navigation', { name: /atlas ride/i });
    expect(within(rideNav).getByRole('link', { name: /driver.*partner/i })).toHaveAttribute('href', '/ride/driver');
  });

  it('links Driver / Partner to compliance and documents to profile photo', () => {
    const { unmount } = render(<MemoryRouter><DriverHomePage /></MemoryRouter>);
    const driverNav = screen.getByRole('navigation', { name: /atlas ride/i });
    expect(within(driverNav).getByRole('link', { name: /^compliance$/i })).toHaveAttribute('href', '/ride/driver/compliance');
    unmount();

    const compliance = render(<MemoryRouter><ComplianceHomePage /></MemoryRouter>);
    const complianceNav = screen.getByRole('navigation', { name: /atlas ride/i });
    expect(within(complianceNav).getByRole('link', { name: /documents.*credentials/i })).toHaveAttribute('href', '/ride/driver/compliance/documents');
    compliance.unmount();

    render(<MemoryRouter><DocumentsPage /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /profile photo/i })).toHaveAttribute('href', '/ride/driver/compliance/documents/profile-photo');
  });

  it('has a concrete profile-photo page instead of a generic placeholder route', () => {
    expect(existsSync(resolve(moduleRoot, 'ProfilePhotoCompliancePage.tsx'))).toBe(true);
    const source = readFileSync(resolve(moduleRoot, 'ProfilePhotoCompliancePage.tsx'), 'utf8');
    expect(source).toMatch(/profile photo/i);
    expect(source).not.toMatch(/coming soon/i);
  });
});
