import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const page = readFileSync('apps/web/src/modules/tools/CopyPaste777Page.tsx', 'utf8');
const preview = readFileSync('apps/web/src/modules/tools/SmartAutofill777Preview.tsx', 'utf8');
describe('ATLAS Smart Autofill consent preview contract', () => {
  it('mounts the sandbox inside the authenticated tool workspace', () => {
    expect(page).toContain('<SmartAutofill777Preview />');
  });
  it('requires individual consent before local preview filling', () => {
    expect(preview).toContain('approved.includes(p.fieldId)');
    expect(preview).toContain('disabled={!proposals.length || !approved.length}');
    expect(preview).toContain('proposals.filter(p => approved.includes(p.fieldId))');
  });
  it('uses ephemeral data and never submits or visits external forms', () => {
    expect(preview).toContain('setProfile({})');
    expect(preview).toContain('readOnly value={filled[field.id] ||');
    expect(preview).not.toContain('localStorage');
    expect(preview).not.toContain('fetch(');
    expect(preview).not.toContain('type="submit"');
  });
});
