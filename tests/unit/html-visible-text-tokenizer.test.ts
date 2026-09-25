import { describe, expect, it } from 'vitest';
import { htmlToVisibleText } from '../../packages/tax-irs-monitor/src/html-to-visible-text.mjs';
import { normalizeContent } from '../../packages/tax-irs-monitor/src/monitor.mjs';

describe('HTML visible-text tokenizer', () => {
  it('drops script content with malformed closing-tag attributes', () => {
    const html = '<p>before</p><script>secret()</script\t\n bar><p>after</p>';
    const visible = htmlToVisibleText(html);
    expect(visible).toContain('before');
    expect(visible).toContain('after');
    expect(visible).not.toContain('secret');
    expect(visible).not.toContain('bar');
  });

  it('drops style content with whitespace and junk before the close bracket', () => {
    const html = '<div>A</div><style media="screen">.x{display:none}</style \n data-x><div>B</div>';
    const visible = htmlToVisibleText(html);
    expect(visible).toContain('A');
    expect(visible).toContain('B');
    expect(visible).not.toContain('display:none');
    expect(visible).not.toContain('data-x');
  });

  it('respects quoted greater-than signs in attributes', () => {
    const html = '<script data-test="a>b">hidden</script><p title="x>y">shown</p>';
    const visible = htmlToVisibleText(html);
    expect(visible).not.toContain('hidden');
    expect(visible).toContain('shown');
  });

  it('fails closed for an unterminated raw-text element', () => {
    const visible = htmlToVisibleText('<p>safe</p><script>never expose this');
    expect(visible).toContain('safe');
    expect(visible).not.toContain('never expose this');
  });

  it('preserves block boundaries for IRS semantic diffing', () => {
    const normalized = normalizeContent('<h1>Title</h1><p>Credit update</p><div>Deadline changed</div>');
    expect(normalized).toBe('Title\nCredit update\nDeadline changed');
  });
});
