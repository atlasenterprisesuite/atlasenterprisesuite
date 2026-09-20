import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('ATLAS canonical workflow consolidation', () => {
  const verify = read('.github/workflows/verify.yml');
  const cloudflare = read('.github/workflows/cloudflare-deploy.yml');
  const globalProduction = read('.github/workflows/global-production-verify.yml');
  const release = read('.github/workflows/release.yml');
  const security = read('.github/workflows/github-security-baseline.yml');
  const infraStatus = read('supabase/functions/atlas-infra-status/index.ts');
  const wrangler = read('wrangler.jsonc');

  it('keeps one canonical Cloudflare deployment credential and account configuration', () => {
    expect(cloudflare).toContain('CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}');
    expect(cloudflare).not.toContain('secrets.CLOUDFLARE_ACCOUNT_ID');
    expect(cloudflare).not.toContain('vars.CLOUDFLARE_ACCOUNT_ID');
    expect(infraStatus).toContain("Deno.env.get('CLOUDFLARE_API_TOKEN')");
    expect(infraStatus).not.toContain("Deno.env.get('CF_API_TOKEN')");
    expect(wrangler).toContain('"account_id": "1dd6dea2bb98459c66f610464354d686"');
  });

  it('rejects obsolete token-generation paths instead of reviving them', () => {
    expect(existsSync('scripts/mint-cloudflare-deploy-token.mjs')).toBe(false);
    expect(existsSync('scripts/resolve-cloudflare-auth.mjs')).toBe(false);
    expect(verify).toContain('Alternate Cloudflare credential namespace or obsolete token-generation path detected.');
    expect(security).toContain('prohibited alternate Cloudflare credential or obsolete token-generation path');
  });

  it('uses a non-mutating Wrangler validation gate for PR and feature verification', () => {
    expect(verify).toContain('pull_request:');
    expect(verify).toContain('branches-ignore: ["main"]');
    expect(verify).toContain('versions upload --dry-run --config wrangler.jsonc');
    expect(verify).toContain('npm run verify:all');
    expect(verify).not.toContain('wrangler@4 deploy --config wrangler.jsonc');
  });

  it('keeps production deployment fail-closed and bound to the exact commit SHA', () => {
    expect(cloudflare).toContain('wrangler@4 deploy --config wrangler.jsonc --tag "$GITHUB_SHA"');
    expect(cloudflare).toContain('uses: ./.github/workflows/global-production-verify.yml');
    expect(cloudflare).toContain('mode: fail-closed');
    expect(globalProduction).toContain('--expected-sha "$GITHUB_SHA"');
    expect(globalProduction).toContain('critical_network_routes_reachable');
    expect(globalProduction).toContain('Enforce final global deployment gate');
  });

  it('publishes releases only after exact production verification without redeploying', () => {
    expect(release).toContain('uses: ./.github/workflows/global-production-verify.yml');
    expect(release).toContain('mode: fail-closed');
    expect(release).toContain("if: needs.verify-production.outputs.verified == 'true'");
    expect(release).toContain('git tag -a "$RELEASE_TAG" "$RELEASE_SHA"');
    expect(release).toContain('gh release create "$RELEASE_TAG"');
    expect(release).not.toContain('wrangler deploy');
  });

  it('keeps the weekly security baseline as the single security audit workflow', () => {
    expect(security).toContain('cron: "23 11 * * 1"');
    expect(security).toContain('Enforce canonical Cloudflare credential namespace');
    expect(security).toContain('Verify fail-closed production security contract');
  });
});
