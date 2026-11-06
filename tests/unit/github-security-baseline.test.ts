import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('GitHub security baseline summary shell safety', () => {
  it('escapes Markdown backticks instead of executing shell substitutions', () => {
    const workflow = readFileSync('.github/workflows/github-security-baseline.yml', 'utf8');
    const escapedBacktick = String.fromCharCode(92, 96);
    const summaries = [
      ['Repository', 'REPOSITORY'],
      ['Owner', 'OWNER_LOGIN'],
      ['Owner type', 'OWNER_TYPE'],
      ['Organization 2FA requirement', 'TWO_FACTOR']
    ] as const;

    for (const [label, variable] of summaries) {
      const expected = `printf "%s\\n" "- ${label}: ${escapedBacktick}$${variable}${escapedBacktick}"`;
      expect(workflow).toContain(expected);
    }
    expect(workflow).not.toContain('echo "- Repository: `$REPOSITORY`"');
  });
});
