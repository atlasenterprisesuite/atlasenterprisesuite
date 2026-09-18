import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = 'supabase/functions';
const RESPONSES_CALL_PATTERN = /api[.]openai[.]com\\/v1\\/responses/;
const GOVERNED_ADAPTER = 'supabase/functions/atlas-copilot/openai-responses-adapter.mjs';

function filesUnder(path: string): string[] {
  return readdirSync(path).flatMap((name) => {
    const full = join(path, name);
    return statSync(full).isDirectory() ? filesUnder(full) : [full];
  });
}

describe('ATLAS OpenAI provider-storage contract', () => {
  it('requires every Responses API call to be fail-closed or governed', () => {
    const callers = filesUnder(ROOT)
      .filter((path) => /\.(ts|mjs|js)$/.test(path))
      .filter((path) => RESPONSES_CALL_PATTERN.test(readFileSync(path, 'utf8')));

    expect(callers.length).toBeGreaterThan(0);

    for (const path of callers) {
      const source = readFileSync(path, 'utf8');
      const normalized = relative('.', path).replaceAll('\\', '/');
      if (normalized === GOVERNED_ADAPTER) {
        expect(source).toContain('store:store===true');
      } else {
        expect(source, `${normalized} must remain provider no-store unless routed through ATLAS governance`)
          .toMatch(/store\s*:\s*false/);
      }
    }
  });
});
