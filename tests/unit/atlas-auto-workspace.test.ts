import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync('.github/workflows/atlas-auto-workspace.yml', 'utf8');

describe('ATLAS Auto Workspace', () => {
  it('can start directly from structured issue events without relying on a bot-created label event', () => {
    expect(workflow).toContain('types: [opened, edited, reopened, labeled]');
    expect(workflow).toContain("const ownerModule = readField('Owner module')");
    expect(workflow).toContain("const issueType = readField('Issue type')");
    expect(workflow).toContain("const priority = readField('Priority')");
    expect(workflow).toContain('const eligibleByBody = structured && !blockedByBody');
    expect(workflow).toContain("labelNames.includes('execution:auto-eligible')");
  });

  it('fails closed for P0, security-sensitive, production mutation, or human-review issues', () => {
    expect(workflow).toContain("prioritySlug === 'p0'");
    expect(workflow).toContain('/^yes$/i.test(securitySensitive)');
    expect(workflow).toContain('/^yes$/i.test(productionMutation)');
    expect(workflow).toContain("labelNames.includes('review:human-required')");
    expect(workflow).toContain("labelNames.includes('security:sensitive')");
    expect(workflow).toContain("labelNames.includes('production:mutation')");
    expect(workflow).toContain("labelNames.includes('priority:p0')");
  });

  it('creates an idempotent isolated branch and draft PR without claiming completion', () => {
    expect(workflow).toContain('atlas/issue-');
    expect(workflow).toContain('.atlas/workspaces/issue-');
    expect(workflow).toContain('openPulls[0]');
    expect(workflow).toContain('draft: true');
    expect(workflow).toContain('workspace:auto-created');
    expect(workflow).toContain('This file establishes an isolated implementation workspace. It does not claim the issue is implemented.');
    expect(workflow).toContain('This draft PR is a workspace, not completion evidence.');
  });

  it('keeps production verification separate and preserves governed executor metadata', () => {
    expect(workflow).toContain('Production verification required separately when applicable');
    expect(workflow).toContain('ATLAS Director');
    expect(workflow).toContain('Codex');
    expect(workflow).toContain('contents: write');
    expect(workflow).toContain('pull-requests: write');
  });
});
