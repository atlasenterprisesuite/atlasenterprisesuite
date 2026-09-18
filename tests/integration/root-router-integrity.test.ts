import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('apps/web/src/main.tsx', 'utf8');

describe('ATLAS root router integrity', () => {
  it('keeps only the canonical route-family dispatch', () => {
    expect(source).toContain("location.pathname.startsWith('/hospitality')");
    expect(source).toContain("location.pathname.startsWith('/ride')");
    expect(source.match(/return <App \/>;/g)).toHaveLength(1);
  });

  it('does not retain unreachable legacy voice routing', () => {
    expect(source).not.toContain("location.pathname === '/voice'");
    expect(source).not.toContain("import { AtlasVoicePage }");
    expect(source).not.toContain("import { AtlasShell }");
  });
});
