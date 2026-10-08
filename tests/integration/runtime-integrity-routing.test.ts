import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const main = readFileSync('apps/web/src/main.tsx', 'utf8');
const routes = readFileSync('apps/web/src/modules/cloud/AtlasCloudRoutes.tsx', 'utf8');
const next = readFileSync('apps/web/src/modules/cloud/AtlasCloudNextLevel.tsx', 'utf8');
const page = readFileSync('apps/web/src/modules/cloud/AtlasRuntimeIntegrityPage.tsx', 'utf8');
const guard = readFileSync('apps/web/src/runtime/AtlasRuntimeIntegrityProvider.tsx', 'utf8');
const runtime = readFileSync('apps/web/src/runtime/runtimeIntegrity.ts', 'utf8');

describe('ATLAS Runtime Integrity integration', () => {
  it('wraps the web application with a global React error boundary and browser listeners', () => {
    expect(main).toContain('AtlasRuntimeIntegrityProvider');
    expect(guard).toContain('componentDidCatch');
    expect(guard).toContain('installRuntimeIntegrityListeners');
    expect(runtime).toContain("window.addEventListener('unhandledrejection'");
    expect(runtime).toContain("window.addEventListener('securitypolicyviolation'");
  });

  it('exposes Runtime Integrity through the existing Cloud control plane', () => {
    expect(routes).toContain('/cloud/runtime-integrity');
    expect(routes).toContain('AtlasRuntimeIntegrityPage');
    expect(next).toContain('/cloud/runtime-integrity');
    expect(page).toContain('Browser Diagnostics');
  });

  it('preserves truthful release boundaries and secret redaction', () => {
    expect(runtime).toContain("fetch('/deployment.json'");
    expect(runtime).toContain("return null");
    expect(runtime).toContain('[REDACTED]');
    expect(page).toContain('ATLAS does not invent a commit SHA');
    expect(page).toContain('browser-session evidence only');
  });

  it('keeps extension and compatibility noise outside the release-blocking class', () => {
    expect(runtime).toContain("category: 'browser_extension'");
    expect(runtime).toContain("severity: 'P3'");
    expect(runtime).toContain("code: 'react_render_failure'");
    expect(runtime).toContain("severity: 'P0'");
  });
});
