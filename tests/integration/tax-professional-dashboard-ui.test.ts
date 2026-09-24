import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ATLAS Tax professional dashboard visual contract', () => {
  const dashboard = readFileSync(process.cwd() + '/apps/web/src/modules/tax/TaxProfessionalDashboard.tsx', 'utf8');
  const routes = readFileSync(process.cwd() + '/apps/web/src/modules/tax/TaxRoutes.tsx', 'utf8');
  const css = readFileSync(process.cwd() + '/apps/web/src/modules/tax/tax.css', 'utf8');

  it('renders the approved professional workspace structure', () => {
    expect(dashboard).toContain('Professional Workspace');
    expect(dashboard).toContain('Return Workflow');
    expect(dashboard).toContain('Productive Core');
    expect(dashboard).toContain('Depth Source Engines');
    expect(dashboard).toContain('2025 Individual Return Core');
    expect(dashboard).toContain('Next Engines');
    expect(dashboard).toContain('TRUST THROUGH A COMPLETE RECORD');
  });

  it('keeps all eleven workflow stages linked to real Tax routes', () => {
    for (const label of [
      'Client / Engagement',
      'Return',
      'Documents / Books',
      'Tax Fact Ledger',
      'Workpapers',
      'Forms / Lines',
      'Diagnostics',
      'Review',
      'Signature',
      'Immutable Submission Snapshot',
      'Carryforwards / Audit'
    ]) expect(dashboard).toContain(label);

    expect(dashboard).not.toContain('href="#"');
  });

  it('uses the dashboard as the Tax home inside the authenticated route tree', () => {
    expect(routes).toContain("import { TaxProfessionalDashboard }");
    expect(routes).toContain('return <TaxProfessionalDashboard />');
    expect(routes).toContain('RequireAtlasIdentity');
  });

  it('does not fabricate provider readiness or a fake signed-in professional', () => {
    expect(dashboard).not.toContain('Taylor Reed');
    expect(dashboard).not.toContain('All Systems Operational');
    expect(dashboard).not.toContain('CI GREEN');
    expect(dashboard).toContain('E-file provider gated');
    expect(dashboard).toContain('Fail-closed governance');
  });

  it('implements the approved dark blue responsive visual system', () => {
    expect(css).toContain('.tax-shell-pro');
    expect(css).toContain('.tax-dashboard-workflow');
    expect(css).toContain('.tax-workflow-track');
    expect(css).toContain('.tax-dashboard-grid');
    expect(css).toContain('.tax-dashboard-trust');
    expect(css).toContain('@media (max-width: 700px)');
  });
});
