import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync('.github/workflows/atlas-auto-workspace.yml', 'utf8');

describe('ATLAS Auto Workspace', () => {
  it('creates an isolated branch and draft PR only from auto-eligible issues', () => {
    expect(workflow).toContain("github.event.label.name == 'execution:auto-eligible'");
    expect(workflow).toContain("labelNames.includes('execution:auto-eligible')");
    expect(workflow).toContain("labelNames.includes('review:human-required')");
    expect(workflow).toContain("labelNames.includes('security:sensitive')");
    expect(workflow).toContain("labelNames.includes('production:mutation')");
    expect(workflow).toContain("labelNames.includes('priority:p0')");
    expect(workflow).toContain('draft: true');
  });

  it('is idempotent and does not claim implementation completion', () => {
    expect(workflow).toContain('atlas/issue-');
    expect(workflow).toContain('.atlas/workspaces/issue-');
    expect(workflow).toContain('openPulls[0]');
    expect(workflow).toContain('workspace:auto-created');
    expect(workflow).toContain('This file establishes an isolated implementation workspace. It does not claim the issue is implemented.');
    expect(workflow).toContain('This draft PR is a workspace, not completion evidence.');
  });

  it('keeps production verification separate and preserves governed execution metadata', () => {
    expect(workflow).toContain('Production verification required separately when applicable');
    expect(workflow).toContain('ATLAS Director');
    expect(workflow).toContain('Codex');
    expect(workflow).toContain('contents: write');
    expect(workflow).toContain('pull-requests: write');
  });
});
