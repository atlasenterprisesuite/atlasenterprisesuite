import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync('.github/workflows/atlas-intelligent-issue-router.yml', 'utf8');

describe('ATLAS Intelligent Issue Router', () => {
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
    expect(workflow).toContain("prioritySlug === 'p0'");
    expect(workflow).toContain('/^yes$/i.test(securitySensitive)');
    expect(workflow).toContain('/^yes$/i.test(productionMutation)');
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
});
