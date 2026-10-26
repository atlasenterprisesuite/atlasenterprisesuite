import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const charter = readFileSync('docs/governance/ATLAS_HUMANITARIAN_ETHICS_CHARTER_V0_1.md', 'utf8');
const security = readFileSync('SECURITY.md', 'utf8');
const design = readFileSync('DESIGN.md', 'utf8');
const humanity = readFileSync('docs/knowledge/humanity-atlas/README.md', 'utf8');
const bible = readFileSync('docs/knowledge/bible-os/ATLAS_BIBLE_OS_CRITICAL_TEXT_SPEC.md', 'utf8');

describe('Humanitarian ethics contract — static guardrails, not runtime enforcement', () => {
  it('requires equal access and freedom of conscience', () => {
    expect(charter).toMatch(/Equal access:/);
    expect(charter).toMatch(/Freedom of conscience:/);
    expect(charter).toMatch(/nonbelief/);
    expect(charter).toMatch(/opt-in/);
  });
  it('requires revocation, tenant isolation and atomic audit', () => {
    expect(charter).toMatch(/revocation/);
    expect(charter).toMatch(/Cross-tenant read\/write denied/);
    expect(charter).toMatch(/audit and transaction remain atomic/);
    expect(security).toMatch(/Supabase RLS/);
    expect(security).toMatch(/organization scoping and RBAC/);
  });
  it('preserves accessibility and religious/scientific truth separation', () => {
    expect(design).toMatch(/WCAG 2\.2 AA/);
    expect(charter).toMatch(/keyboard access/);
    expect(humanity).toMatch(/theological/);
    expect(bible).toMatch(/Faith\/history separation/);
  });
  it('requires fail-closed release verification', () => {
    expect(charter).toMatch(/Fail closed on P0/);
    expect(charter).toMatch(/No merge or deployment until verified/);
  });
});
