import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflowPath = '.github/workflows/cloudflare-token-self-heal.yml';
const workflow = readFileSync(workflowPath, 'utf8');

describe('ATLAS Cloudflare token self-heal', () => {
  it('uses existing provider capability before requesting token-policy self-management', () => {
    const directIndex = workflow.indexOf('Reconcile legacy trigger with existing token capability');
    const repairIndex = workflow.indexOf('Inspect and repair Cloudflare token policy');

    expect(directIndex).toBeGreaterThan(-1);
    expect(repairIndex).toBeGreaterThan(directIndex);
    expect(workflow).toContain("id: direct");
    expect(workflow).toContain("if: steps.direct.outputs.direct_access != 'true'");
    expect(workflow).toContain('/workers/scripts');
    expect(workflow).toContain('/builds/workers/$LEGACY_TAG/triggers');
    expect(workflow).toContain('/builds/triggers/$TRIGGER_ID');
  });

  it('re-queries Cloudflare after direct deletion and fails over to governed repair when proof is incomplete', () => {
    expect(workflow).toContain('/tmp/cf-direct-triggers-recheck.json');
    expect(workflow).toContain('REMAINING=');
    expect(workflow).toContain('Legacy trigger still exists after the direct reconciliation attempt');
    expect(workflow).toContain('attempting token-policy repair');
    expect(workflow).toContain('Cloudflare token policy is not self-repairable; failing closed.');
  });

  it('preserves the exact fail-closed global production verifier after reconciliation', () => {
    expect(workflow).toContain('global-production-verification:');
    expect(workflow).toContain('needs: repair-cloudflare-token');
    expect(workflow).toContain('uses: ./.github/workflows/global-production-verify.yml');
    expect(workflow).toContain('mode: fail-closed');
    expect(workflow).toContain('Canonical Worker $CANONICAL_WORKER was not modified.');
  });
});
