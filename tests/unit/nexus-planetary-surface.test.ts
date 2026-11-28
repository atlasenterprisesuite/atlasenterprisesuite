import { describe, expect, it } from 'vitest';
import { materialAt, materialForNode } from '../../apps/web/src/modules/galaxy/planetarySurface';

describe('NEXUS planetary materials', () => {
  it('maps canonical nodes to distinct material families', () => {
    expect(materialForNode('core')).toBe('star');
    expect(materialForNode('finance')).toBe('rock');
    expect(materialForNode('accounting')).toBe('ocean');
    expect(materialForNode('crm')).toBe('desert');
    expect(materialForNode('security')).toBe('gas');
    expect(materialForNode('payroll')).toBe('ice');
    expect(materialForNode('inventory')).toBe('volcanic');
    expect(materialForNode('unknown')).toBe('rock');
  });
  it('generates deterministic bounded RGB values with surface variation', () => {
    for (const id of ['core','finance','accounting','crm','security','payroll','inventory']) {
      const kind = materialForNode(id);
      const samples = Array.from({length: 128}, (_, i) => {
        const theta = i * Math.PI / 64;
        const y = Math.sin(i * 0.17) * 0.95;
        const r = Math.sqrt(1-y*y);
        const point = [r*Math.cos(theta),y,r*Math.sin(theta)] as const;
        const color = materialAt(kind, ...point);
        expect(materialAt(kind, ...point)).toEqual(color);
        expect(color.every(c => Number.isFinite(c) && c >= 0 && c <= 255)).toBe(true);
        return color.join(',');
      });
      expect(new Set(samples).size).toBeGreaterThan(16);
    }
  });
  it('rejects invalid surface coordinates', () => {
    expect(() => materialAt('rock', NaN, 0, 1)).toThrow();
    expect(() => materialAt('rock', 4, 0, 0)).toThrow();
  });
});
