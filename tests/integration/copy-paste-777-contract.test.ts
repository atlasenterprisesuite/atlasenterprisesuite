import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync('apps/web/src/App.tsx', 'utf8');
const main = readFileSync('apps/web/src/main.tsx', 'utf8');
const page = readFileSync('apps/web/src/modules/tools/CopyPaste777Page.tsx', 'utf8');

describe('ATLAS Copy Paste 777 integration contract', () => {
  it('uses the canonical authenticated route without bypassing root dispatch', () => {
    expect(app).toContain('path="/tools/copy-paste-777"');
    expect(app).toContain('<RequireAtlasIdentity><CopyPaste777Page /></RequireAtlasIdentity>');
    expect(main.match(/return <App \/>;/g)).toHaveLength(1);
    expect(main).not.toContain("location.pathname === '/tools/copy-paste-777'");
  });
  it('provides editable, labeled template and clipboard controls', () => {
    for (const marker of ['htmlFor="atlas-template"', 'htmlFor="atlas-title"', 'htmlFor="atlas-content"', 'navigator.clipboard.writeText', 'Guardar plantilla', 'Copiar todo']) {
      expect(page).toContain(marker);
    }
  });
  it('retains bounded local history and announces outcomes accessibly', () => {
    expect(page).toContain('.slice(0, 20)');
    expect(page).toContain('role="status" aria-live="polite"');
    expect(page).toContain('Borrar historial');
  });
});
