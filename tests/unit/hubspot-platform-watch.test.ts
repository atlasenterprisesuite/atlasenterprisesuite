import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const script = readFileSync('scripts/verify-hubspot-platform.mjs', 'utf8');
const workflow = readFileSync('.github/workflows/hubspot-platform-watch.yml', 'utf8');

describe('HubSpot platform drift watch', () => {
  it('pins ATLAS to date-based HubSpot OAuth, CRM and project contracts', () => {
    expect(script).toContain('/oauth/2026-03/token');
    expect(script).toContain('/crm/objects/2026-03');
    expect(script).toContain('"platformVersion": "2026.09"');
    expect(script).toContain('crm.objects.tickets.read');
  });

  it('runs daily and opens a review issue only when the watcher finds drift', () => {
    expect(workflow).toContain("cron: '17 10 * * *'");
    expect(workflow).toContain('issues: write');
    expect(workflow).toContain('verify-hubspot-platform.mjs');
    expect(workflow).toContain('[HubSpot Platform Watch] Review required');
    expect(workflow).toContain('steps.watch.outcome == \'failure\'');
  });
});
