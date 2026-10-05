import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const manifestPath = resolve(process.cwd(), 'apps/reconnect-autofill-extension/public/manifest.json');

function readManifest() {
  let manifest: any;
  let loadError: unknown;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (error) {
    loadError = error;
  }
  expect(loadError, 'Manifest V3 source must exist and parse').toBeUndefined();
  return manifest;
}

describe('ATLAS Reconnect least-privilege Manifest V3 package', () => {
  test('uses Manifest V3 and only the official Reconnect host permission', () => {
    const manifest = readManifest();
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.host_permissions).toEqual(['https://connect.myflorida.com/*']);
    expect(JSON.stringify(manifest)).not.toContain('<all_urls>');
  });

  test('defines popup and content-script entries without persistent storage permission', () => {
    const manifest = readManifest();
    expect(manifest.action.default_popup).toBe('popup.html');
    expect(manifest.content_scripts).toEqual([
      expect.objectContaining({
        matches: ['https://connect.myflorida.com/*'],
        js: ['content.js']
      })
    ]);
    expect(manifest.permissions ?? []).not.toContain('storage');
    expect(manifest.permissions ?? []).not.toContain('cookies');
    expect(manifest.permissions ?? []).not.toContain('webRequest');
  });

  test('does not permit external/eval script execution', () => {
    const manifest = readManifest();
    const csp = manifest.content_security_policy?.extension_pages ?? "script-src 'self'; object-src 'self'";
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toMatch(/unsafe-eval|https?:\/\//i);
  });
});
