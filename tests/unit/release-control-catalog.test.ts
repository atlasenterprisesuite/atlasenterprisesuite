import { describe, expect, it } from 'vitest';
import { RELEASE_CATALOG } from '../../packages/release-control/src';

describe('ATLAS release catalog', () => {
  it('assigns every module to one deterministic release wave with unique codes', () => {
    const codes = RELEASE_CATALOG.map((item) => item.moduleCode);
    expect(new Set(codes).size).toBe(codes.length);
    expect(RELEASE_CATALOG.every((item) => item.releaseWave >= 0 && item.releaseWave <= 7)).toBe(true);
  });

  it('places foundation, finance, people, platform, health, mobility and specialized surfaces in the approved waves', () => {
    const byCode = new Map(RELEASE_CATALOG.map((item) => [item.moduleCode, item]));

    expect(byCode.get('release-controller')?.releaseWave).toBe(0);
    expect(byCode.get('accounting')?.releaseWave).toBe(1);
    expect(byCode.get('payroll')?.releaseWave).toBe(2);
    expect(byCode.get('crm')?.releaseWave).toBe(3);
    expect(byCode.get('voice')?.releaseWave).toBe(4);
    expect(byCode.get('automations')?.releaseWave).toBe(4);
    expect(byCode.get('site-review')?.releaseWave).toBe(4);
    expect(byCode.get('spatial')?.releaseWave).toBe(4);
    expect(byCode.get('health')?.releaseWave).toBe(5);
    expect(byCode.get('telecom')?.releaseWave).toBe(6);
    expect(byCode.get('atlas-pay')?.releaseWave).toBe(7);
  });

  it('includes every already-implemented cross-module platform surface in the queue', () => {
    const codes = new Set(RELEASE_CATALOG.map((item) => item.moduleCode));
    expect(codes.has('automations')).toBe(true);
    expect(codes.has('site-review')).toBe(true);
    expect(codes.has('spatial')).toBe(true);
  });

  it('encodes cross-wave dependencies instead of relying on percentages or UI order', () => {
    const byCode = new Map(RELEASE_CATALOG.map((item) => [item.moduleCode, item]));

    expect(byCode.get('accounting')?.dependencies).toContain('release-controller');
    expect(byCode.get('payroll')?.dependencies).toContain('accounting');
    expect(byCode.get('purchasing')?.dependencies).toContain('accounting');
    expect(byCode.get('atlas-pay')?.dependencies).toContain('accounting');
    expect(byCode.get('health')?.dependencies).toContain('release-controller');
    expect(byCode.get('automations')?.dependencies).toContain('release-controller');
    expect(byCode.get('site-review')?.dependencies).toContain('release-controller');
    expect(byCode.get('spatial')?.dependencies).toContain('release-controller');
  });
});
