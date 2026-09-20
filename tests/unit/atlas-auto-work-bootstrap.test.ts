import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const bootstrap = require('../../.github/workflows/lib/atlas-issue-work-bootstrap.cjs') as {
  branchNameFor: (issue: { number: number; title: string }) => string;
  isAutoEligible: (issue: { state: string; pull_request?: unknown; labels: Array<string | { name: string }> }) => boolean;
};

const workflow = readFileSync('.github/workflows/atlas-intelligent-issue-router.yml', 'utf8');
const engine = readFileSync('.github/workflows/lib/atlas-issue-work-bootstrap.cjs', 'utf8');

describe('ATLAS auto-work bootstrap', () => {
  it('builds deterministic safe branch names', () => {
    expect(bootstrap.branchNameFor({ number: 42, title: 'Finance / AR: Fix Aging & Collections' }))
      .toBe('atlas/issue-42-finance-ar-fix-aging-collections');
  });

  it('permits only open explicitly auto-eligible non-sensitive issues', () => {
    expect(bootstrap.isAutoEligible({
      state: 'open',
      labels: ['execution:auto-eligible', 'priority:p3', 'agent:codex'],
    })).toBe(true);

    for (const blocked of ['review:human-required', 'security:sensitive', 'production:mutation', 'priority:p0']) {
      expect(bootstrap.isAutoEligible({
        state: 'open',
        labels: ['execution:auto-eligible', blocked],
      })).toBe(false);
    }

    expect(bootstrap.isAutoEligible({
      state: 'closed',
      labels: ['execution:auto-eligible'],
    })).toBe(false);
  });

  it('uses a second least-privilege job for branch and PR mutations', () => {
    expect(workflow).toContain('bootstrap-work:');
    expect(workflow).toContain('pull-requests: write');
    expect(workflow).toContain('contents: write');
    expect(workflow).toContain('id-token: write');
    expect(workflow).toContain('persist-credentials: false');
    expect(workflow).toContain("require('./.github/workflows/lib/atlas-issue-work-bootstrap.cjs')");
    expect(workflow).not.toContain('pull_request_target');
  });

  it('creates an auditable draft workspace without claiming completion or deployment', () => {
    expect(engine).toContain('git.createRef');
    expect(engine).toContain('repos.createOrUpdateFileContents');
    expect(engine).toContain('pulls.create');
    expect(engine).toContain('draft: true');
    expect(engine).toContain('docs/ops/issue-work/issue-');
    expect(engine).toContain('This draft PR is not completion evidence.');
    expect(engine).toContain('Production deployment remains a separate authorized step.');
    expect(engine).toContain('work:bootstrapped');
    expect(engine).toContain('PR_BRIDGE_AUDIENCE');
    expect(engine).toContain('work:pr-blocked');
  });

  it('fails closed when governance becomes human-required', () => {
    expect(engine).toContain('convertPullRequestToDraft');
    expect(engine).toContain('review:human-required');
    expect(engine).toContain('work:blocked');
    expect(engine).toContain('This PR is forced to remain a draft');
  });

  it('is idempotent across repeated issue edits', () => {
    expect(engine).toContain('findOpenPull');
    expect(engine).toContain('getRef');
    expect(engine).toContain('getContent');
    expect(engine).toContain('upsertMarkerComment');
    expect(engine).toContain('<!-- atlas-auto-work-bootstrap -->');
  });
});
