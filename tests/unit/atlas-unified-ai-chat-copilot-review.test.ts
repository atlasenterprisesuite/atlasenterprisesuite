import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflowPath = '.github/workflows/atlas-copilot-review.yml';
const scriptPath = 'scripts/atlas-copilot-review-evidence.mjs';

describe('ATLAS exact-SHA Copilot review evidence', () => {
  it('defines a minimum-permission workflow that requests the official Copilot reviewer', () => {
    expect(existsSync(workflowPath)).toBe(true);
    if (!existsSync(workflowPath)) return;
    const workflow = readFileSync(workflowPath, 'utf8');
    expect(workflow).toContain('pull_request:');
    expect(workflow).not.toContain('pull_request_target:');
    expect(workflow).toContain('contents: read');
    expect(workflow).toContain('pull-requests: write');
    expect(workflow).toContain('copilot-pull-request-reviewer[bot]');
    expect(workflow).toContain('requested_effort: balanced');
    expect(workflow).toContain('github.event.pull_request.head.sha');
    expect(workflow).not.toContain('permissions: write-all');
  });

  it('rejects stale Copilot review evidence from an older PR head', async () => {
    expect(existsSync(scriptPath)).toBe(true);
    if (!existsSync(scriptPath)) return;
    const { normalizeCopilotReviewEvidence } = await import('../../scripts/atlas-copilot-review-evidence.mjs');
    const evidence = normalizeCopilotReviewEvidence({
      repository: 'atlasenterprisesuite/atlasenterprisesuite',
      prNumber: 621,
      headSha: 'new-sha',
      requested: true,
      reviews: [{ id: 1, user: { login: 'copilot-pull-request-reviewer[bot]' }, commit_id: 'old-sha', state: 'COMMENTED' }],
      comments: [{ id: 11, user: { login: 'copilot-pull-request-reviewer[bot]' }, commit_id: 'old-sha', path: 'x.ts', line: 2, body: 'old finding' }],
    });
    expect(evidence).toMatchObject({ head_sha: 'new-sha', requested: true, completed: false, stale: true, authoritative: false, blocking_decision: 'advisory' });
    expect(evidence.findings).toEqual([]);
  });

  it('accepts only findings anchored to the current PR head SHA', async () => {
    expect(existsSync(scriptPath)).toBe(true);
    if (!existsSync(scriptPath)) return;
    const { normalizeCopilotReviewEvidence } = await import('../../scripts/atlas-copilot-review-evidence.mjs');
    const evidence = normalizeCopilotReviewEvidence({
      repository: 'atlasenterprisesuite/atlasenterprisesuite',
      prNumber: 621,
      headSha: 'head-sha',
      requested: true,
      reviews: [{ id: 2, user: { login: 'copilot-pull-request-reviewer[bot]' }, commit_id: 'head-sha', state: 'COMMENTED' }],
      comments: [
        { id: 21, user: { login: 'copilot-pull-request-reviewer[bot]' }, commit_id: 'head-sha', path: 'a.ts', line: 9, body: 'current finding' },
        { id: 22, user: { login: 'copilot-pull-request-reviewer[bot]' }, commit_id: 'old-sha', path: 'b.ts', line: 4, body: 'stale finding' },
      ],
    });
    expect(evidence).toMatchObject({ completed: true, stale: false, observed_effort: 'effort_unconfirmed', requested_effort: 'balanced' });
    expect(evidence.findings).toHaveLength(1);
    expect(evidence.findings[0]).toMatchObject({ finding_id: '21', path: 'a.ts', line: 9, status: 'open' });
  });

  it('records missing entitlement/service as unavailable rather than passed', async () => {
    expect(existsSync(scriptPath)).toBe(true);
    if (!existsSync(scriptPath)) return;
    const { normalizeCopilotReviewEvidence } = await import('../../scripts/atlas-copilot-review-evidence.mjs');
    const evidence = normalizeCopilotReviewEvidence({
      repository: 'atlasenterprisesuite/atlasenterprisesuite', prNumber: 621, headSha: 'head-sha',
      requested: false, requestError: 'copilot_review_unavailable', reviews: [], comments: [],
    });
    expect(evidence).toMatchObject({ status: 'unavailable', completed: false, stale: false, authoritative: false, blocking_decision: 'advisory' });
    expect(JSON.stringify(evidence)).not.toContain('passed');
  });
});
