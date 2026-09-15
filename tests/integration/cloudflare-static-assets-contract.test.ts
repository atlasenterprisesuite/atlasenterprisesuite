import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const wrangler = readFileSync('wrangler.jsonc', 'utf8');
const workflow = readFileSync('.github/workflows/cloudflare-deploy.yml', 'utf8');

describe('Cloudflare Workers Static Assets deployment contract', () => {
  it('serves the Vite SPA build as Workers static assets', () => {
    expect(wrangler).toContain('"name": "atlas-enterprise-suite-web"');
    expect(wrangler).toContain('"directory": "./apps/web/dist"');
    expect(wrangler).toContain('"not_found_handling": "single-page-application"');
  });

  it('deploys only after the repository validation gates', () => {
    expect(workflow).toContain('npm run typecheck');
    expect(workflow).toContain('npm run test:unit');
    expect(workflow).toContain('npm run test:integration');
    expect(workflow).toContain('npm run build');
    expect(workflow).toContain('wrangler@4 deploy');
  });

  it('accepts the official Cloudflare GitHub App deployment when direct credentials are unavailable', () => {
    expect(workflow).toContain('checks: read');
    expect(workflow).toContain('Workers Builds: atlas-enterprise-suite-web');
    expect(workflow).toContain('/commits/${GITHUB_SHA}/check-runs');
    expect(workflow).toContain('cloudflare_native_build_verified');
    expect(workflow).toContain('cloudflare-native-github-app');
  });

  it('exports the deployment probe before constructing ATLAS Manager evidence', () => {
    expect(workflow).toContain('export DEPLOYMENT_PROBE');
  });

  it('verifies the deployed Access gateway fails closed for anonymous requests', () => {
    expect(workflow).toContain('ROOT_STATUS=');
    expect(workflow).toContain('SPA_STATUS=');
    expect(workflow).toContain('HEALTH_STATUS=');
    expect(workflow).toContain('test "$ROOT_STATUS" = "401"');
    expect(workflow).toContain('test "$SPA_STATUS" = "401"');
    expect(workflow).toContain('test "$HEALTH_STATUS" = "401"');
    expect(workflow).toContain('Access gateway smoke verification passed.');
  });

  it('keeps custom-domain cutover separate from the initial worker deploy', () => {
    expect(wrangler).not.toContain('custom_domain');
    expect(workflow).toContain('workers.dev');
  });
});
