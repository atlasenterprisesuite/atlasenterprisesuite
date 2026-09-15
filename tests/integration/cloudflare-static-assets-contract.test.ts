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

  it('uses the official Cloudflare GitHub App as the primary deployment path', () => {
    expect(workflow).toContain('checks: read');
    expect(workflow).toContain('Workers Builds: atlas-enterprise-suite-web');
    expect(workflow).toContain('/commits/${GITHUB_SHA}/check-runs');
    expect(workflow).toContain('cloudflare_native_build_verified');
    expect(workflow).toContain('cloudflare-native-github-app');
    expect(workflow).toContain('DIRECT_DEPLOY_REQUESTED');
    expect(workflow).toContain("vars.CLOUDFLARE_DIRECT_DEPLOY == 'true'");
    expect(workflow).toContain('if [ "$DIRECT_DEPLOY_REQUESTED" = "true" ]');
  });

  it('resolves an invalid configured account ID only when explicit direct deploy is selected', () => {
    expect(workflow).toContain('Resolve Cloudflare account ID');
    expect(workflow).toContain('https://api.cloudflare.com/client/v4/accounts');
    expect(workflow).toContain('::add-mask::$RESOLVED_ACCOUNT_ID');
    expect(workflow).toContain('steps.cloudflare_account.outputs.account_id');
    expect(workflow).toContain('Expected exactly one accessible Cloudflare account');
  });

  it('exports the deployment probe before constructing ATLAS Manager evidence', () => {
    expect(workflow).toContain('export DEPLOYMENT_PROBE');
  });

  it('verifies the public custom domain serves the website and Identity shell anonymously', () => {
    expect(workflow).toContain('PRODUCTION_URL: https://www.atlasenterprisesuite.com');
    expect(workflow).toContain('ROOT_STATUS=');
    expect(workflow).toContain('IDENTITY_STATUS=');
    expect(workflow).toContain('MODULE_STATUS=');
    expect(workflow).toContain('test "$ROOT_STATUS" = "200"');
    expect(workflow).toContain('test "$IDENTITY_STATUS" = "200"');
    expect(workflow).toContain('test "$MODULE_STATUS" = "200"');
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
