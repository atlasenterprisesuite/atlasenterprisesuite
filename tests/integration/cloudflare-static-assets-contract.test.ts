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

  it('uses exactly one Cloudflare credential source in production CI', () => {
    expect(workflow).toContain('CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}');
    expect(workflow).not.toContain('vars.CLOUDFLARE_API_TOKEN');
    expect(workflow).not.toContain('CF_API_TOKEN');
    expect(workflow).not.toContain('CF_ACCOUNT_ID');
  });

  it('pins the non-secret Cloudflare account once in canonical Wrangler config', () => {
    expect(wrangler).toContain('"account_id": "1dd6dea2bb98459c66f610464354d686"');
    expect(workflow).not.toContain('secrets.CLOUDFLARE_ACCOUNT_ID');
    expect(workflow).not.toContain('vars.CLOUDFLARE_ACCOUNT_ID');
  });

  it('fails Cloudflare authorization before expensive repository verification', () => {
    const preflight = workflow.indexOf('Cloudflare authorization preflight');
    const verify = workflow.indexOf('npm run verify:all');
    const deploy = workflow.indexOf('wrangler@4 deploy');
    expect(preflight).toBeGreaterThan(-1);
    expect(verify).toBeGreaterThan(preflight);
    expect(deploy).toBeGreaterThan(verify);
  });

  it('classifies provider failures without logging the token', () => {
    expect(workflow).toContain('cloudflare_failure_category=configuration');
    expect(workflow).toContain('cloudflare_failure_category=authentication');
    expect(workflow).toContain('cloudflare_failure_category=authorization');
    expect(workflow).toContain('cloudflare_failure_category=provider');
    expect(workflow).not.toContain('echo "$CLOUDFLARE_API_TOKEN"');
    expect(workflow).not.toContain('printf \'%s\' "$CLOUDFLARE_API_TOKEN"');
  });

  it('reports only what the non-mutating Worker preflight actually proves', () => {
    expect(workflow).toContain('worker_endpoint_reachable=true');
    expect(workflow).not.toContain('workers_authorized=true');
  });

  it('bounds Cloudflare preflight network calls', () => {
    const preflight = workflow.slice(
      workflow.indexOf('- name: Cloudflare authorization preflight'),
      workflow.indexOf('- name: Install native media verification dependencies'),
    );
    expect(preflight).toContain('--max-time 30');
  });

  it('prefers direct Wrangler whenever the canonical token secret is available, including main pushes', () => {
    expect(workflow).toContain('MODE="direct-wrangler"');
    expect(workflow).toContain('else\n            MODE="cloudflare-native-github-app"');
    expect(workflow).not.toContain('if [ "$GITHUB_EVENT_NAME" = "push" ]; then\n            MODE="cloudflare-native-github-app"');
  });

  it('does not require Cloudflare account-list permission', () => {
    expect(workflow).not.toContain('https://api.cloudflare.com/client/v4/accounts?per_page=50');
  });

  it('exports the deployment probe before constructing ATLAS Manager evidence', () => {
    expect(workflow).toContain('export DEPLOYMENT_PROBE');
  });

  it('verifies the public custom domain serves the website, Identity shell, and critical Network routes', () => {
    expect(workflow).toContain('PRODUCTION_URL: https://www.atlasenterprisesuite.com');
    expect(workflow).toContain('probe_route "Public home"');
    expect(workflow).toContain('probe_route "ATLAS Identity"');
    expect(workflow).toContain('probe_route "Module SPA shell"');
    expect(workflow).toContain('Public ATLAS production domain and critical Network routes verified.');
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
