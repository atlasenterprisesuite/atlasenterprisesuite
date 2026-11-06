import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('GitHub security baseline summary shell safety', () => {
  it('escapes Markdown backticks instead of executing shell substitutions', () => {
    const workflow = readFileSync('.github/workflows/github-security-baseline.yml', 'utf8');
    expect(workflow).toContain('printf "%s\\n" "- Repository: \`$REPOSITORY\`"');
    expect(workflow).toContain('printf "%s\\n" "- Owner: \`$OWNER_LOGIN\`"');
    expect(workflow).toContain('printf "%s\\n" "- Owner type: \`$OWNER_TYPE\`"');
    expect(workflow).toContain('printf "%s\\n" "- Organization 2FA requirement: \`$TWO_FACTOR\`"');
    expect(workflow).not.toContain('echo "- Repository: `$REPOSITORY`"');
  });
});
