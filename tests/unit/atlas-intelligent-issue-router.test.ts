import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { classify } = require('../../.github/workflows/lib/atlas-issue-classifier.cjs');
import { describe, expect, it } from 'vitest';

const workflow = readFileSync('.github/workflows/atlas-intelligent-issue-router.yml', 'utf8');
const issueForm = readFileSync('.github/ISSUE_TEMPLATE/atlas-intelligent-issue.yml', 'utf8');

describe('ATLAS Intelligent Issue Router', () => {
  it('offers ATLAS Device OS as a structured owner, avoiding legacy fallback', () => {
    expect(issueForm).toContain('        - ATLAS Device OS');
  });

  it('routes issue-form intake through Director and Codex without fake GitHub agent assignees', () => {
    expect(workflow).toContain('issues:');
    expect(workflow).toContain('types: [opened, edited, reopened]');
    expect(workflow).toContain('issues: write');
    expect(workflow).toContain('route:atlas-director');
    expect(workflow).toContain('agent:codex');
    expect(workflow).toContain('agent:director');
    expect(workflow).toContain("repository.data.owner.type === 'User'");
    expect(workflow).not.toContain('pull_request_target');
  });

  it('fails closed for P0, security-sensitive, production mutation, and legacy intake', () => {
    expect(readFileSync('.github/workflows/lib/atlas-issue-classifier.cjs', 'utf8')).toContain("priority === 'P0'");
    expect(workflow).toContain('classification.sensitive');
    expect(workflow).toContain('classification.autoEligible');
    expect(workflow).toContain('review:human-required');
    expect(workflow).toContain('intake:legacy');
  });

  it('keeps automatic execution eligibility distinct from implementation evidence', () => {
    expect(workflow).toContain('execution:auto-eligible');
    expect(workflow).toContain('Routing is metadata, not evidence of implementation or production readiness.');
    expect(workflow).toContain('Completion still requires the issue acceptance criteria and verification evidence.');
  });

  it('re-routes edited issues without leaving stale controlled labels', () => {
    expect(workflow).toContain('controlledPrefixes');
    expect(workflow).toContain('issues.removeLabel');
    expect(workflow).toContain('issues.addLabels');
    expect(workflow).toContain('existingRoutingComment');
    expect(workflow).toContain('issues.updateComment');
  });
  it('classifies #908 legacy text without granting execution', () => {
    const result = classify({
      title: 'ATLAS Universal Intelligence 777 — evidence-based video audit MVP',
      body: 'Parent governance: #324. P0: identity/tenant permissions and audit remain incomplete. No merge/deploy until independently verified.',
    });
    expect(result).toMatchObject({
      module: 'ATLAS Universal Intelligence 777',
      type: 'Feature', priority: 'P0', structured: false,
      complete: true, sensitive: true, autoEligible: false,
    });
  });

  it('does not guess missing module or priority', () => {
    expect(classify({ title: 'Please investigate', body: 'Need help' })).toMatchObject({
      complete: false, autoEligible: false,
    });
  });

  it('keeps incomplete security answers blocked even with structured fields', () => {
    const result = classify({
      title: 'ATLAS Universal Intelligence 777',
      body: '### Owner module\\nATLAS Universal Intelligence 777\\n\\n### Issue type\\nFeature\\n\\n### Priority\\nP2',
    });
    expect(result).toMatchObject({ structured: true, complete: true, autoEligible: false });
  });
});
