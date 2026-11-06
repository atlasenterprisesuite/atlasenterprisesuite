import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const configPath = 'tests/e2e/playwright.gps.config.mjs';
const browserPath = 'tests/e2e/gps-earth-authenticated.e2e.mjs';
const config = readFileSync(configPath, 'utf8');
const browser = readFileSync(browserPath, 'utf8');

describe('ATLAS GPS Earth authenticated browser gate — source integrity only', () => {
  it('parses both ESM files with the runtime Node syntax checker', () => {
    for (const path of [configPath, browserPath]) {
      expect(() => execFileSync(process.execPath, ['--check', path], { stdio: 'pipe' })).not.toThrow();
    }
  });

  it('requires exact deployment identity before entering E2E credentials', () => {
    for (const item of ['ATLAS_E2E_BASE_URL', 'ATLAS_E2E_ALLOWED_ORIGIN',
      'ATLAS_E2E_EXPECTED_SHA', 'ATLAS_E2E_EMAIL', 'ATLAS_E2E_PASSWORD']) {
      expect(config).toContain(item);
    }
    expect(browser).toContain("headers['x-atlas-version-id']");
    expect(browser).toContain("headers['x-atlas-version-tag']");
    expect(browser.indexOf('await openVerifiedGps(page)'))
      .toBeLessThan(browser.indexOf("await page.getByLabel('Email').fill(userEmail)"));
  });

  it('cannot certify browser or reviewer completion from unit tests', () => {
    const runbook = readFileSync('docs/runbooks/ATLAS_GPS_EARTH_E2E_REVIEW_GATE.md', 'utf8');
    expect(runbook).toContain('physical Safari NOT VERIFIED');
    expect(runbook).toContain('independent reviewer NOT APPROVED');
    expect(runbook).toContain('Browser test prepared, NOT EXECUTED');
  });
});
