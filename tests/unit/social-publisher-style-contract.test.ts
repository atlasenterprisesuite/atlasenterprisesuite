import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pagePath = resolve(process.cwd(), 'apps/web/src/modules/business/social/SocialPublisherPage.tsx');
const stylesheetPath = resolve(process.cwd(), 'apps/web/src/modules/business/social/social.css');

describe('Social Publisher responsive style contract', () => {
  it('keeps the publisher stylesheet colocated and imported by the page', () => {
    const pageSource = readFileSync(pagePath, 'utf8');

    expect(pageSource).toContain("import './social.css';");
    expect(existsSync(stylesheetPath)).toBe(true);
  });

  it('preserves the responsive layout and media composer selectors', () => {
    expect(existsSync(stylesheetPath)).toBe(true);
    if (!existsSync(stylesheetPath)) return;

    const stylesheet = readFileSync(stylesheetPath, 'utf8');
    [
      '.platform-tabs',
      '.publisher-grid',
      '.media-dropzone',
      '.publisher-actions',
      '.social-frame',
      '@media (max-width: 980px)',
      '@media (max-width: 560px)'
    ].forEach((token) => expect(stylesheet).toContain(token));
  });
});
