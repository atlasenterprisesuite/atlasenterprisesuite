import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const wrangler = readFileSync('wrangler.jsonc', 'utf8');
const workflow = readFileSync('.github/workflows/cloudflare-deploy.yml', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts?: Record<string, string> };

describe('Cloudflare Workers Static Assets deployment contract', () => {
  it('serves the Vite SPA build as Workers static assets', () => {
    expect(wrangler).toContain('"name": "atlas-enterprise-suite-web"');
    expect(wrangler).toContain('"directory": "./apps/web/dist"');
    expect(wrangler).toContain('"not_found_handling": "single-page-application"');
  });

  it('deploys only after the shared repository validation gate', () => {
    expect(workflow).toContain('npm run verify:all');
    const verifyAll = pkg.scripts?.['verify:all'] || '';
    expect(verifyAll).toContain('npm audit --audit-level=high');
    expect(verifyAll).toContain('npm run typecheck');
    expect(verifyAll).toContain('npm run test:unit');
    expect(verifyAll).toContain('npm run test:integration');
    expect(verifyAll).toContain('npm run build');
    expect(workflow).toContain('wrangler@4 deploy');
  });

  it('accepts the official Cloudflare GitHub App deployment when direct credentials are unavailable', () => {
    expect(workflow).toContain('checks: read');
    expect(workflow).toContain('Workers Builds: atlas-enterprise-suite-web');
    expect(workflow).toContain('/commits/${GITHUB_SHA}/check-runs');
    expect(workflow).toContain('cloudflare_native_build_verified');
    expect(workflow).toContain('cloudflare-native-github-app');
  });

  it('prefers direct Wrangler whenever secure Cloudflare credentials are available, including main pushes', () => {
    expect(workflow).toContain('if [ "$TOKEN_SECRET_PRESENT" = "true" ] && { [ "$ACCOUNT_SECRET_PRESENT" = "true" ] || [ "$ACCOUNT_VARIABLE_PRESENT" = "true" ]; }; then');
    expect(workflow).toContain('MODE="direct-wrangler"');
    expect(workflow).toContain('else\n            MODE="cloudflare-native-github-app"');
    expect(workflow).not.toContain('if [ "$GITHUB_EVENT_NAME" = "push" ]; then\n            MODE="cloudflare-native-github-app"');
  });

  it('uses the configured account ID directly without requiring account-list permission', () => {
    expect(workflow).toContain('Use configured Cloudflare account ID');
    expect(workflow).toContain('RESOLVED_ACCOUNT_ID="$CONFIGURED_ACCOUNT_ID"');
    expect(workflow).not.toContain('https://api.cloudflare.com/client/v4/accounts?per_page=50');
    expect(workflow).toContain('::add-mask::$RESOLVED_ACCOUNT_ID');
    expect(workflow).toContain('steps.cloudflare_account.outputs.account_id');
  });

  it('exports the deployment probe before constructing ATLAS Manager evidence', () => {
    expect(workflow).toContain('export DEPLOYMENT_PROBE');
  });

  it('verifies the public custom domain serves the website and Identity shell anonymously', () => {
    expect(workflow).toContain('PRODUCTION_URL: https://www.atlasenterprisesuite.com');
    expect(workflow).toContain('probe_route "Public home"');
    expect(workflow).toContain('probe_route "ATLAS Identity"');
    expect(workflow).toContain('probe_route "Module SPA shell"');
    expect(workflow).toContain('Public ATLAS web shell verified.');
  });

  it('records that module authorization is enforced by tested ATLAS Identity rather than edge-wide Access', () => {
    expect(workflow).toContain('public_home_reachable:true');
    expect(workflow).toContain('identity_route_reachable:true');
    expect(workflow).toContain('module_spa_shell_reachable:true');
    expect(workflow).toContain('module_authorization_boundary:\'atlas-identity\'');
    expect(workflow).not.toContain('access_gateway_fail_closed:true');
  });

  it('keeps custom-domain routing separate from the worker artifact declaration', () => {
    expect(wrangler).not.toContain('custom_domain');
    expect(workflow).toContain('workers.dev');
  });
});
