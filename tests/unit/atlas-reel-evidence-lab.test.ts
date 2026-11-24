import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

const asset = (file: string) => readFileSync(resolve(process.cwd(), 'apps/web/public/tools', file), 'utf8');

function openLab() {
  const html = asset('atlas-reel-evidence-lab.html');
  const javascript = asset('atlas-reel-evidence-lab.js');
  const dom = new JSDOM(html, { url: 'https://atlas.example/tools/atlas-reel-evidence-lab.html', runScripts: 'outside-only' });
  dom.window.eval(javascript);
  const document = dom.window.document;
  const input = (id: string, value: string) => {
    const field = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement;
    field.value = value;
    field.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  };
  const click = (id: string) => (document.getElementById(id) as HTMLButtonElement).click();
  return { dom, document, input, click };
}

describe('ATLAS Reel Evidence Lab 777', () => {
  it('has a CSP-compatible same-origin script and a protected Studio entry point', () => {
    const html = asset('atlas-reel-evidence-lab.html');
    const page = readFileSync(resolve(process.cwd(), 'apps/web/src/modules/creator/content/ContentIntelligencePage.tsx'), 'utf8');
    expect(html).toContain('src="/tools/atlas-reel-evidence-lab.js"');
    expect(html).not.toMatch(/<script>(.|\n)*?<\/script>/);
    expect(html).not.toContain('https://cdn.');
    expect(page).toContain('href="/tools/atlas-reel-evidence-lab.html"');
    expect(asset('atlas-reel-evidence-lab.js')).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|sendBeacon\s*\(/);
  });

  it('registers a URL only as reference, strips tracking, and rejects script URLs', () => {
    const { dom, document, input, click } = openLab();
    input('sourceUrl', 'https://www.instagram.com/reel/abc123/?gwpx=secret&utm_source=ad');
    click('registerUrl');
    expect((document.getElementById('sourceUrl') as HTMLInputElement).value).toBe('https://www.instagram.com/reel/abc123/');
    expect(document.getElementById('sourceStatus')?.textContent).toContain('No se han recuperado');
    input('sourceUrl', 'javascript:alert(1)');
    click('registerUrl');
    expect(document.getElementById('sourceStatus')?.textContent).toContain('URL inválida');
    dom.window.close();
  });

  it('cannot mark a claim as supported without supporting evidence', () => {
    const { dom, document, input, click } = openLab();
    input('claimText', 'Una afirmación que requiere pruebas');
    (document.getElementById('claimStatus') as HTMLSelectElement).value = 'supported';
    click('addClaim');
    expect(document.getElementById('claimTotal')?.textContent).toBe('0');
    expect(document.getElementById('sourceStatus')?.textContent).toContain('debes describir su evidencia');
    input('claimEvidence', 'Fotograma a los 00:01');
    click('addClaim');
    expect(document.getElementById('claimTotal')?.textContent).toBe('1');
    expect(document.getElementById('verdict')?.textContent).not.toContain('VERIFICACIÓN EXTERNA COMPLETA');
    dom.window.close();
  });
});
