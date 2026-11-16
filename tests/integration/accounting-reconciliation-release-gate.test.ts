import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const sha = 'a'.repeat(40);
const route = '/finance/accounting/reconciliation';
const workflow = readFileSync('.github/workflows/global-production-verify.yml', 'utf8');
const runBlock = workflow.match(/- name: Verify through authorized ATLAS runtime after classified edge challenge[\s\S]*?run: \|\n([\s\S]*?)(?=\n      - name:)/)?.[1];
if (!runBlock) throw new Error('Authorized production verification step is missing.');
const script = runBlock.split('\n').map(line => line.replace(/^ {10}/, '')).join('\n');

function runAuthorizedStep(proof: Record<string, unknown> | undefined) {
  const directory = mkdtempSync(join(tmpdir(), 'atlas-reconciliation-gate-'));
  try {
    const bin = join(directory, 'bin');
    mkdirSync(bin);
    // Replace only network I/O; execute the actual workflow's gate and outputs.
    writeFileSync(join(bin, 'curl'), `#!/usr/bin/env node\nconst fs = require('node:fs');\nconst args = process.argv.slice(2);\nif (args.at(-1).includes('audience=atlas-production-http-verifier')) process.stdout.write(JSON.stringify({value:'fixture-oidc'}));\nelse { const at=args.indexOf('--output'); if(at<0) process.exit(2); fs.copyFileSync(process.env.ATLAS_TEST_RESPONSE,args[at+1]); process.stdout.write('200'); }\n`, { mode: 0o700 });
    const checks: Record<string, unknown> = {};
    for (const key of ['status_route_reachable', 'all_module_routes_reachable', 'public_home_reachable', 'suite_route_reachable', 'identity_route_reachable', 'manager_readiness_route_reachable', 'accessibility_route_reachable', 'gps_route_reachable', 'module_spa_shell_reachable', 'finance_accounting_route_reachable', 'accounts_payable_route_reachable', 'accounts_receivable_route_reachable', 'procure_to_pay_route_reachable', 'knowledge_route_reachable', 'work_routes_reachable', 'health_route_reachable', 'jaque_mate_sentinel_route_reachable', 'studio_web_launch_route_reachable', 'commerce_route_reachable', 'revenue_route_reachable', 'analytics_route_reachable', 'critical_network_routes_reachable', 'critical_crm_routes_reachable', 'deployment_path_protected']) checks[key] = true;
    checks.canonical_module_routes = proof ? { [route]: proof } : {};
    const response = join(directory, 'response.json');
    writeFileSync(response, JSON.stringify({ ok: true, verifier_version: 32, target_sha: sha, checks }));
    const output = join(directory, 'output.txt');
    writeFileSync(output, '');
    const result = spawnSync('bash', ['-c', script.replaceAll('/tmp/atlas-authorized-global-production.json', join(directory, 'authorized.json'))], {
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, ATLAS_TEST_RESPONSE: response, ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'fixture-token', ACTIONS_ID_TOKEN_REQUEST_URL: 'https://fixture.invalid?test=true', GITHUB_SHA: sha, GITHUB_OUTPUT: output, GITHUB_STEP_SUMMARY: join(directory, 'summary.txt') },
      encoding: 'utf8', timeout: 15_000
    });
    if (result.error) throw result.error;
    return { status: result.status, output: readFileSync(output, 'utf8'), stderr: result.stderr };
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

describe('reconciliation production fallback evidence', () => {
  it.each([
    ['missing route proof', undefined],
    ['failed route', { status: 403, atlas_version_id: 'worker-fixture', atlas_version_tag: sha }],
    ['wrong commit', { status: 200, atlas_version_id: 'worker-fixture', atlas_version_tag: 'b'.repeat(40) }],
    ['missing version identity', { status: 200, atlas_version_tag: sha }]
  ])('rejects %s even when aggregate module checks are true', (_name, proof) => {
    const result = runAuthorizedStep(proof);
    expect(result.status).toBe(1);
    expect(result.output).toContain('verified=false');
    expect(result.output).not.toContain('verified=true');
  }, 20_000);

  it('accepts reachable per-route evidence for the exact expected commit', () => {
    const result = runAuthorizedStep({ status: 200, atlas_version_id: 'worker-fixture', atlas_version_tag: sha });
    expect(result.status, result.stderr).toBe(0);
    expect(result.output).toContain('verified=true');
  }, 20_000);
});
