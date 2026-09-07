import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ATLAS repair bridge source contract', () => {
  const path = 'adapters/supabase/atlas-repair-bridge/index.ts';

  it('is pinned to canonical main and the reviewed repair executor workflow', () => {
    expect(existsSync(path)).toBe(true);
    if (!existsSync(path)) return;
    const code = readFileSync(path, 'utf-8');

    expect(code).toContain("const REPO='atlasenterprisesuite/atlasenterprisesuite'");
    expect(code).toContain("const OWNER='atlasenterprisesuite'");
    expect(code).toContain('.github/workflows/atlas-ai-repair-executor.yml@refs/heads/main');
    expect(code).toContain("const AUD='atlas-enterprise-suite-repair'");
  });

  it('allows only canonical validation commands that actually exist in package.json', () => {
    expect(existsSync(path)).toBe(true);
    if (!existsSync(path)) return;
    const code = readFileSync(path, 'utf-8');

    expect(code).toContain('npm run test:unit');
    expect(code).toContain('npm run test:integration');
    expect(code).toContain('npm run typecheck');
    expect(code).toContain('npm run build');
    expect(code).not.toContain('npm run check:provider-independence');
  });

  it('keeps workflow, bridge, runner, secret-like paths and destructive patches protected', () => {
    expect(existsSync(path)).toBe(true);
    if (!existsSync(path)) return;
    const code = readFileSync(path, 'utf-8');

    expect(code).toContain("'.github/'");
    expect(code).toContain("'adapters/supabase/atlas-repair-bridge/'");
    expect(code).toContain("'scripts/atlas-ai-repair-runner.mjs'");
    expect(code).toContain('GIT binary patch');
    expect(code).toContain('deleted file mode');
  });
});
