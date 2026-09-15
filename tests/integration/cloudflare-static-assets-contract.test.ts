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

  it('resolves an invalid configured account ID only when the token exposes exactly one accessible account', () => {
    expect(workflow).toContain('Resolve Cloudflare account ID');
    expect(workflow).toContain('https://api.cloudflare.com/client/v4/accounts');
    expect(workflow).toContain('::add-mask::$RESOLVED_ACCOUNT_ID');
    expect(workflow).toContain('steps.cloudflare_account.outputs.account_id');
    expect(workflow).toContain('Expected exactly one accessible Cloudflare account');
  });

  it('exports the deployment probe before constructing ATLAS Manager evidence', () => {
    expect(workflow).toContain('export DEPLOYMENT_PROBE');
  });

  it('treats Cloudflare Access redirect or explicit denial as a fail-closed production perimeter', () => {
    expect(workflow).toContain('302|303)');
    expect(workflow).toContain('401|403)');
    expect(workflow).toContain('SERVER_HEADER=');
    expect(workflow).toContain('server: cloudflare');
    expect(workflow).toContain('winder-aranguren.cloudflareaccess.com/cdn-cgi/access/login/');
    expect(workflow).toContain('Cloudflare production perimeter fails closed.');
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
