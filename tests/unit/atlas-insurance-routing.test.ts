import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveAtlasIdentityTarget } from '../../apps/web/src/identity/IdentityPage';
import { resolveInsuranceReturnTo } from '../../apps/web/src/modules/insurance/insuranceApi';

const root = process.cwd();
const moduleRoot = resolve(root, 'apps/web/src/modules/insurance');
const routePath = resolve(moduleRoot, 'InsuranceRoutes.tsx');
const homePath = resolve(moduleRoot, 'InsuranceHome.tsx');
const appPath = resolve(root, 'apps/web/src/App.tsx');

describe('ATLAS Insurance routing boundaries', () => {
  it('allows insurance destinations through ATLAS Identity', () => {
    expect(resolveAtlasIdentityTarget('/insurance')).toBe('/insurance');
    expect(resolveAtlasIdentityTarget('/insurance/verify?scope=insurance_access')).toBe('/insurance/verify?scope=insurance_access');
  });

  it('keeps insurance return targets inside the Insurance module', () => {
    expect(resolveInsuranceReturnTo('/insurance')).toBe('/insurance');
    expect(resolveInsuranceReturnTo('/insurance/member/opaque-123')).toBe('/insurance/member/opaque-123');
    expect(resolveInsuranceReturnTo('https://evil.example')).toBe('/insurance');
    expect(resolveInsuranceReturnTo('//evil.example')).toBe('/insurance');
    expect(resolveInsuranceReturnTo('/finance')).toBe('/insurance');
    expect(resolveInsuranceReturnTo('/insurance\\evil')).toBe('/insurance');
  });

  it('exposes a protected Insurance home and verification route', () => {
    expect(existsSync(routePath)).toBe(true);
    expect(existsSync(homePath)).toBe(true);
    const source = readFileSync(routePath, 'utf8');
    expect(source).toContain('RequireAtlasIdentity');
    expect(source).toContain('path="/insurance"');
    expect(source).toContain('path="/insurance/verify"');
  });

  it('exposes ATLAS Insurance from Enterprise Home', () => {
    const source = readFileSync(appPath, 'utf8');
    expect(source).toContain('to="/insurance"');
    expect(source).toContain('ATLAS Insurance');
  });
});
