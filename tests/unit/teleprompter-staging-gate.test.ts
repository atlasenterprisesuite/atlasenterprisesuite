import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const script = 'scripts/verify-teleprompter-staging.mjs';
const reference = 'qawxltbplsxcjvwxdkes'; // Example alternative project ref, not a usable staging backend.

function probe(additions: Record<string, string>) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    !key.startsWith('VITE_SUPABASE_') && !key.startsWith('VITE_ATLAS_STAGING_')
    && key !== 'ATLAS_TELEPROMPTER_STAGING' && key !== 'VERCEL_ENV'
  ));
  return spawnSync(process.execPath, [script], {
    env: { ...env, ...additions },
    encoding: 'utf8',
    timeout: 5_000
  });
}

describe('Teleprompter preview staging security gate', () => {
  it('fails closed when a Vercel preview is missing staging configuration', () => {
    const result = probe({ VERCEL_ENV: 'preview' });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('teleprompter_staging_isolation_required');
  });

  it('rejects preview credentials pointed at the production project', () => {
    const result = probe({
      VERCEL_ENV: 'preview',
      VITE_SUPABASE_URL: 'https://ggmanzcgtlrvqfoccgsh.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable-test-only',
      VITE_ATLAS_STAGING_PROJECT_REF: 'ggmanzcgtlrvqfoccgsh'
    });
    expect(result.status).not.toBe(0);
  });

  it('rejects mismatched project ID, HTTP and proxy backend URL', () => {
    for (const url of [
      `http://${reference}.supabase.co`,
      'https://other.example.com',
      'https://unrelatedprojrefxxxx.supabase.co'
    ]) {
      const result = probe({
        VERCEL_ENV: 'preview',
        VITE_SUPABASE_URL: url,
        VITE_ATLAS_STAGING_PROJECT_REF: reference,
        VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable-test-only'
      });
      expect(result.status).not.toBe(0);
    }
  });

  it('accepts only an explicitly matching non-production project ref for preview', () => {
    const result = probe({
      VERCEL_ENV: 'preview',
      VITE_SUPABASE_URL: `https://${reference}.supabase.co`,
      VITE_SUPABASE_PUBLISHABLE_KEY: 'publishable-test-only',
      VITE_ATLAS_STAGING_PROJECT_REF: reference
    });
    expect(result.status).toBe(0);
  });

  it('does not modify the production build contract', () => {
    expect(probe({ VERCEL_ENV: 'production' }).status).toBe(0);
  });

  it('executes gate from the web build, including direct workspace builds', () => {
    const pkg = JSON.parse(readFileSync('apps/web/package.json', 'utf8'));
    expect(pkg.scripts.build).toContain('verify-teleprompter-staging.mjs');
  });
});
