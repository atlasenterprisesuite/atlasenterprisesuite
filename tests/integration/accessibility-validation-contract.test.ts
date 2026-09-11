import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ATLAS Inclusive Communication validation contract', () => {
  it('runs an automated WCAG 2.2 AA axe gate against core routes', () => {
    const workflow = readFileSync('.github/workflows/accessibility-validation.yml', 'utf8');
    expect(workflow).toContain('@axe-core/cli@4.13.0');
    expect(workflow).toContain('wcag22aa');
    expect(workflow).toContain('--exit');
    expect(workflow).toContain('/settings/accessibility/communication');
    expect(workflow).toContain('/finance');
    expect(workflow).toContain('/health');
  });

  it('keeps manual assistive-tech, hardware, and human validation as explicit gates', () => {
    const plan = readFileSync('docs/validation/atlas-inclusive-communication-validation.md', 'utf8');
    expect(plan).toContain('VoiceOver');
    expect(plan).toContain('TalkBack');
    expect(plan).toContain('NVDA');
    expect(plan).toContain('JAWS');
    expect(plan).toContain('Braille');
    expect(plan).toContain('Nothing About Us Without Us');
    expect(plan).toContain('BLOCKED_EXTERNAL');
  });
});
