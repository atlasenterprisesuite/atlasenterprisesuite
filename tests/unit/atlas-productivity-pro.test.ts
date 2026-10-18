import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const pagePath = 'apps/web/src/modules/creator/ProductivityProPage.tsx';

describe('ATLAS Productivity Pro', () => {
  it('registers the identity-gated Studio route and visible Studio entry points', () => {
    expect(existsSync(resolve(process.cwd(), pagePath))).toBe(true);
    const app = source('apps/web/src/App.tsx');
    const studio = source('apps/web/src/modules/creator/CreatorStudioPage.tsx');
    const experience = source('apps/web/src/modules/experience/CreatorExperiencePage.tsx');
    expect(app).toContain("path=\"/studio/productivity-pro\"");
    expect(app).toContain('<RequireAtlasIdentity><ProductivityProPage /></RequireAtlasIdentity>');
    expect(studio).toContain("route: '/studio/productivity-pro'");
    expect(experience).toContain("to: '/studio/productivity-pro'");
  });

  it('executes through the existing governed Assistant bus and fails closed without readiness', () => {
    const page = source(pagePath);
    expect(page).toContain('getAssistantStatus');
    expect(page).toContain('hasVerifiedAssistantProvider');
    expect(page).toContain('sendAssistantWorkspaceMessage');
    expect(page).toContain("profile: 'deep'");
    expect(page).toContain('Verified AI required');
  });

  it('includes Researcher, Analyst and Microsoft integration truth boundaries', () => {
    const page = source(pagePath);
    for (const value of ['Researcher', 'Analyst', 'Microsoft 365 Pro reference', 'Microsoft bridge', 'Fail closed']) {
      expect(page).toContain(value);
    }
    expect(page).toContain('ATLAS does not report Microsoft Graph, Outlook, OneDrive, SharePoint or Teams as connected');
    expect(page).toContain('does not inherit Microsoft 365 Pro licensing or usage limits');
  });
});
