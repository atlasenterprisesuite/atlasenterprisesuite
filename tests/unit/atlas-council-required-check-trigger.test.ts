import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ATLAS council-security required check trigger', () => {
  it('runs for every pull request targeting main, not only Copilot file changes', () => {
    const workflow = readFileSync('.github/workflows/atlas-ai-council-security.yml', 'utf8');
    const prBlock = workflow.split(/\\n  pull_request:\\n/)[1]?.split(/\\n  workflow_dispatch:/)[0];
    expect(prBlock).toBeDefined();
    expect(prBlock).toContain("branches: ['main']");
    expect(prBlock).not.toMatch(/\\n    paths(?:-ignore)?:/);
    expect(workflow).toContain('council-security:');
    expect(workflow).toContain('atlas-ai-council-security-gates.test.mjs');
  });
});
