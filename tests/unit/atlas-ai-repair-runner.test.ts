import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ATLAS canonical repair executor', () => {
  const runnerPath = 'scripts/atlas-ai-repair-runner.mjs';
  const workflowPath = '.github/workflows/atlas-ai-repair-executor.yml';

  it('exists only as a reviewed repair-to-PR path for the canonical repository', () => {
    expect(existsSync(runnerPath)).toBe(true);
    expect(existsSync(workflowPath)).toBe(true);
    if (!existsSync(runnerPath) || !existsSync(workflowPath)) return;

    const runner = readFileSync(runnerPath, 'utf-8');
    const workflow = readFileSync(workflowPath, 'utf-8');

    expect(runner).toContain("const REPOSITORY = 'atlasenterprisesuite/atlasenterprisesuite'");
    expect(runner).toContain('GIT binary patch');
    expect(runner).toContain('deleted file mode');
    expect(runner).toContain("'.github/'");
    expect(runner).toContain("'adapters/supabase/atlas-repair-bridge/'");
    expect(runner).toContain("'scripts/atlas-ai-repair-runner.mjs'");
    expect(runner).toContain("'.env'");
    expect(runner).toContain("'credentials'");
    expect(runner).toContain("'secrets'");
    expect(runner).toContain('git apply --check');
    expect(runner).toContain('pulls');

    expect(workflow).toContain('id-token: write');
    expect(workflow).toContain('contents: write');
    expect(workflow).toContain('pull-requests: write');
    expect(workflow).toContain('atlas-enterprise-suite-repair');
    expect(workflow).toContain('scripts/atlas-ai-repair-runner.mjs');
    expect(workflow).not.toMatch(/push:\s*\n\s*branches:\s*\[?main/);
  });

  it('limits validation commands to existing canonical safe gates', () => {
    expect(existsSync(runnerPath)).toBe(true);
    if (!existsSync(runnerPath)) return;
    const runner = readFileSync(runnerPath, 'utf-8');

    expect(runner).toContain('npm run test:unit');
    expect(runner).toContain('npm run test:integration');
    expect(runner).toContain('npm run typecheck');
    expect(runner).toContain('npm run build');
    expect(runner).not.toContain('npm run check:provider-independence');
  });
});
