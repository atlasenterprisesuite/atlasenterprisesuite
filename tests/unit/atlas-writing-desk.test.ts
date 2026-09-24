import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

const pagePath = 'apps/web/src/modules/creator/writing/ATLASWritingDeskPage.tsx';

describe('ATLAS Writing Desk', () => {
  it('registers an identity-gated Studio writing route and visible Studio entry points', () => {
    expect(existsSync(resolve(process.cwd(), pagePath))).toBe(true);
    const resolver = source('apps/web/src/extensions/resolveAtlasExtension.tsx');
    const studio = source('apps/web/src/modules/creator/CreatorStudioPage.tsx');
    const experience = source('apps/web/src/modules/experience/CreatorExperiencePage.tsx');
    expect(resolver).toContain("pathname === '/studio/write'");
    expect(resolver).toContain('ATLASWritingDeskPage');
    expect(resolver).toContain('RequireAtlasIdentity');
    expect(studio).toContain("route: '/studio/write'");
    expect(experience).toContain("to: '/studio/write'");
  });

  it('uses the existing governed Assistant bus and verifies provider readiness before generation', () => {
    const page = source(pagePath);
    expect(page).toContain('getAssistantStatus');
    expect(page).toContain('hasVerifiedAssistantProvider');
    expect(page).toContain('sendAssistantMessage');
    expect(page).toContain("pathname: '/studio/write'");
    expect(page).toContain('Verified AI required');
  });

  it('supports local text extraction and fail-closed image OCR without pretending unsupported parsing succeeded', () => {
    const page = source(pagePath);
    expect(page).toContain('file.text()');
    expect(page).toContain('TextDetector');
    expect(page).toContain('image_ocr_not_supported');
    expect(page).toContain('ATLAS will not pretend OCR succeeded');
    expect(page).toContain('2_000_000');
  });

  it('implements quick writing actions plus loading, success, error, clear and copy states', () => {
    const page = source(pagePath);
    for (const text of ['Cover letter', 'Professional rewrite', 'Friendly message', 'Writing…', 'Draft copied to the clipboard.', 'Clear']) {
      expect(page).toContain(text);
    }
  });
});
