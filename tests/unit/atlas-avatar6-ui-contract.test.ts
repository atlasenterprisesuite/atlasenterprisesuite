import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const director = readFileSync(resolve(process.cwd(), 'apps/web/src/modules/creator/director/DirectorWorkspace.tsx'), 'utf8');
const panel = readFileSync(resolve(process.cwd(), 'apps/web/src/modules/creator/director/Avatar6HandoffPanel.tsx'), 'utf8');

describe('Avatar 6 Director integration P0', () => {
  it('reuses the canonical Director provider step without a shadow route', () => {
    expect(director).toContain("import { Avatar6HandoffPanel } from './Avatar6HandoffPanel'");
    expect(director).toContain("<Avatar6HandoffPanel spec={state.spec} />");
    expect(director).toContain('<ProviderGate providers={providers}');
  });

  it('offers only local compilation and external handoff, not direct paid execution', () => {
    expect(panel).toContain('compileAvatar6Handoff');
    expect(panel).toContain("const [script, setScript]");
    expect(panel).toContain('readOnly rows={8}');
    expect(panel).toContain('navigator.clipboard.writeText');
    expect(panel).toContain('https://app.heygen.com/appws/script-to-video');
    expect(panel).not.toMatch(/\bfetch\s*\(|x-api-key|import\.meta\.env|Bearer /);
    expect(panel).not.toContain('create_video_from_avatar');
  });

  it('exposes AI disclosure, consent and accessibility boundaries', () => {
    expect(panel).toContain('verified consent');
    expect(panel).toContain('AI-generated media must be disclosed');
    expect(panel).toContain('captions and a transcript');
    expect(panel).toContain('No biometric media is uploaded or saved');
  });
});
