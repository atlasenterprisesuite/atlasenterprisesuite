import { describe, expect, it } from 'vitest';
import { auditHtmlSnapshot, MAX_HTML_SNAPSHOT_BYTES } from '../../apps/web/src/modules/integration/site-review-html-audit';

const origin = 'https://www.example.org';
const item = (html: string, ruleId: string) =>
  auditHtmlSnapshot(html, origin).findings.find((f) => f.ruleId === ruleId);

describe('Site Review offline HTML snapshot heuristics', () => {
  it('detects multiple missing SEO and accessibility source signals', () => {
    const html = '<!doctype html><html><head><title></title></head><body><h1>A</h1><h1>B</h1><img src="x"><a>go</a></body></html>';
    expect(item(html, 'seo.title')?.status).toBe('needs_review');
    expect(item(html, 'seo.meta_description')?.status).toBe('needs_review');
    expect(item(html, 'accessibility.html_lang')?.status).toBe('needs_review');
    expect(item(html, 'accessibility.image_alt')?.status).toBe('needs_review');
    expect(item(html, 'content.h1_count')?.message).toContain('2 H1');
    expect(item(html, 'content.empty_links')?.status).toBe('needs_review');
  });

  it('recognizes supported tags but makes no live or security claims', () => {
    const html = `<!doctype html><html lang="es"><head><title>Demo</title><meta name="description" content="A demo"><meta name="viewport" content="width=device-width"><meta property="og:title" content="Demo"><link rel="canonical" href="https://www.example.org/"></head><body><h1>Hello</h1><img alt="" src="x"><a href="/about">About</a></body></html>`;
    const report = auditHtmlSnapshot(html, origin);
    expect(report.verification).toBe('static_heuristic_only');
    expect(report.reviewCount).toBe(0);
    expect(report.unavailableCount).toBe(4);
    expect(report.findings.every((x) => x.status !== ('passed' as string))).toBe(true);
  });

  it('does not count markup hidden in comments, scripts, styles or templates', () => {
    const html = '<html><head><title>Safe</title></head><body><!-- <h1>Fake</h1> --><script>const x="<h1>Fake</h1>";</script><style>.x{content:"<h1>Fake</h1>"}</style><template><h1>Fake</h1></template><h1>Actual</h1></body></html>';
    expect(item(html, 'content.h1_count')?.status).toBe('present');
  });

  it('never returns raw HTML, credentials or attribute values', () => {
    const html = '<html lang="es"><head><title>SECRET_XYZ</title></head><body><h1>SECURITY_TOKEN_123</h1><a href="/private?token=SECRET">link</a></body></html>';
    const report = auditHtmlSnapshot(html, origin);
    const output = JSON.stringify(report);
    expect(output).not.toContain('SECRET');
    expect(output).not.toContain('SECURITY_TOKEN');
    expect(output).not.toContain('/private');
    expect(output).not.toContain('SECRET_XYZ');
  });

  it('rejects empty/oversize HTML and unsafe supplied origins', () => {
    expect(() => auditHtmlSnapshot('', origin)).toThrow();
    expect(() => auditHtmlSnapshot('x'.repeat(MAX_HTML_SNAPSHOT_BYTES + 1), origin)).toThrow();
    expect(() => auditHtmlSnapshot('<html/>', 'http://127.0.0.1')).toThrow();
  });

  it('does not use DOMParser, eval, HTML sinks or network APIs', () => {
    const html = '<html><body><script>window.DANGEROUS = true; fetch("https://untrusted.test/")</script><h1>Title</h1></body></html>';
    auditHtmlSnapshot(html, origin);
    expect((globalThis as typeof globalThis & { DANGEROUS?: boolean }).DANGEROUS).toBeUndefined();
  });
});
