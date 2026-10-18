import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('Advisory production closure surfaces', () => {
  it('replaces resolvable Advisory placeholders with canonical ATLAS integrations', () => {
    const routes = read('apps/web/src/modules/advisory/AdvisoryRoutes.tsx');
    const operations = read('apps/web/src/modules/advisory/AdvisoryOperationsPages.tsx');

    for (const component of [
      'AdvisoryTasksPage',
      'AdvisoryCrmPage',
      'AdvisoryReportsPage',
      'AdvisoryCompliancePage',
      'AdvisoryAutomationsPage',
      'AdvisorySettingsPage',
      'AdvisoryReadinessPage'
    ]) {
      expect(routes).toContain(component);
      expect(operations).toContain(`function ${component}`);
    }

    expect(routes).not.toContain('<BoundaryPage title="Tasks"');
    expect(routes).not.toContain('<BoundaryPage title="CRM"');
    expect(routes).not.toContain('<BoundaryPage title="Reports"');
    expect(routes).not.toContain('<BoundaryPage title="Compliance"');
    expect(routes).not.toContain('<BoundaryPage title="Automations"');
    expect(routes).not.toContain('<BoundaryPage title="Settings"');
  });

  it('reuses canonical Work, CRM, Accounting, Analytics and Identity routes', () => {
    const operations = read('apps/web/src/modules/advisory/AdvisoryOperationsPages.tsx');
    for (const route of [
      '/work/new',
      '/work/active',
      '/work/approvals',
      '/work/history',
      '/work/policies',
      '/crm/contacts',
      '/crm/companies',
      '/crm/deals',
      '/crm/activities',
      '/crm/integrations',
      '/finance/accounting/accounts-receivable',
      '/analytics',
      '/identity?app=%2Fadvisory',
      '/settings/accessibility/communication'
    ]) {
      expect(operations).toContain(route);
    }
  });

  it('keeps genuinely external or client-identity surfaces fail closed', () => {
    const routes = read('apps/web/src/modules/advisory/AdvisoryRoutes.tsx');
    expect(routes).toContain('<BoundaryPage title="Calendar"');
    expect(routes).toContain('<BoundaryPage title="Documents"');
    expect(routes).toContain('<BoundaryPage title="Client Portal"');
  });

  it('derives Advisory report metrics from authenticated persisted records', () => {
    const operations = read('apps/web/src/modules/advisory/AdvisoryOperationsPages.tsx');
    expect(operations).toContain('listAdvisoryClients()');
    expect(operations).toContain('listAdvisoryEngagements()');
    expect(operations).toContain('listAdvisoryLaunchIntakes()');
    expect(operations).toContain('Revenue and cash are not inferred here');
  });

  it('binds critical Advisory routes into fail-closed production verification', () => {
    const verifier = read('supabase/functions/atlas-cloudflare-production-http-verify/index.ts');
    for (const route of [
      '/advisory/clients',
      '/advisory/engagements',
      '/advisory/business-launch-360/workspace',
      '/advisory/reports',
      '/advisory/providers',
      '/advisory/readiness'
    ]) {
      expect(verifier).toContain(`probe('${route}')`);
      expect(verifier).toContain(`'${route}'`);
    }
    expect(verifier).toContain('const advisoryRoutesOk = [');
    expect(verifier).toContain('advisoryRoutesOk &&');
  });

  it('exposes a truthful Advisory readiness route', () => {
    const routes = read('apps/web/src/modules/advisory/AdvisoryRoutes.tsx');
    const operations = read('apps/web/src/modules/advisory/AdvisoryOperationsPages.tsx');
    expect(routes).toContain("['/advisory/readiness','Readiness']");
    expect(routes).toContain('path="/advisory/readiness"');
    expect(operations).toContain('Production E2E');
    expect(operations).toContain('Evidence required');
    expect(operations).toContain('Client portal');
    expect(operations).toContain('Fail closed');
  });
});
