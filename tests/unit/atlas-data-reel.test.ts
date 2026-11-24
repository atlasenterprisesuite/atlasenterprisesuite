import { describe, expect, it } from 'vitest';
import { createDataReelComposition, parseDataReelRows } from '../../packages/creator/motion/data_reel';
import { validateMotionComposition } from '../../packages/creator/motion/validator';
import { createEmptyProductionSpec } from '../../packages/creator/defaults';
import { validateProductionSpec } from '../../packages/creator/validator';

const points = [
  { label: 'Enrollment', value: '12,345', sourceUrl: 'https://example.org/report/2026' },
  { label: 'Growth', value: '8.2%', sourceUrl: 'https://example.org/research' }
];
const create = () => createDataReelComposition({ id: 'reel-1', title: 'Quarterly facts', points, durationSeconds: 10 });

describe('ATLAS Studio sourced data reels', () => {
  it('parses a simple, auditable row format without inventing data', () => {
    expect(parseDataReelRows('Enrollment | 12,345 | https://example.org/report/2026')).toEqual([points[0]]);
    expect(() => parseDataReelRows('')).toThrow(/at least one/i);
    expect(() => parseDataReelRows('Enrollment | 12,345')).toThrow(/three fields/i);
    expect(() => parseDataReelRows(Array(6).fill('X | 1 | https://example.org').join('\n'))).toThrow(/five/i);
  });

  it('fails closed for blank, unsafe or unverifiable source references', () => {
    for (const url of ['', 'http://example.org', 'javascript:alert(1)', 'https://localhost/facts', 'https://user:secret@example.org']) {
      expect(() => createDataReelComposition({ id: 'r', title: 'Facts', points: [{ label: 'Fact', value: '7', sourceUrl: url }], durationSeconds: 10 })).toThrow(/source/i);
    }
    expect(() => createDataReelComposition({ id: 'r', title: 'Facts', points: [], durationSeconds: 10 })).toThrow(/at least one/i);
    expect(() => createDataReelComposition({ id: 'r', title: ' ', points, durationSeconds: 10 })).toThrow(/title/i);
    expect(() => createDataReelComposition({ id: 'r', title: 'Facts', points, durationSeconds: 3 })).toThrow(/duration/i);
  });

  it('creates deterministic vertical motion layers with retained URLs, captions, and valid timing', () => {
    const spec = create();
    expect(spec).toMatchObject({ template: 'data-reel-v1', dataReelCount: 2, width: 1080, height: 1920, fps: 30, durationSeconds: 10 });
    expect(spec.layers.filter(layer => layer.dataReelRole === 'value')).toHaveLength(2);
    expect(spec.layers.filter(layer => layer.dataReelRole === 'source')).toHaveLength(2);
    expect(spec.layers.find(layer => layer.dataReelRole === 'value')?.sourceUrl).toBe(points[0].sourceUrl);
    expect(spec.layers.find(layer => layer.dataReelRole === 'source')?.name).toBe('Source supplied (unverified): example.org');
    expect(spec.layers.filter(layer => layer.dataReelRole === 'value').every(layer => layer.tracks.length > 0)).toBe(true);
    expect(validateMotionComposition(spec)).toEqual([]);
    expect(JSON.stringify(create())).toBe(JSON.stringify(spec));
  });

  it('blocks tampering and deletion of mandatory source attribution before review', () => {
    const altered = structuredClone(create());
    const fact = altered.layers.find(layer => layer.dataReelRole === 'value')!;
    fact.name = 'Unsupported new number';
    expect(validateMotionComposition(altered).map(issue => issue.code)).toContain('motion.data_reel_claim_changed');

    const hidden = create();
    hidden.layers = hidden.layers.filter(layer => !(layer.dataReelRole === 'source' && layer.sourceUrl === points[0].sourceUrl));
    expect(validateMotionComposition(hidden).map(issue => issue.code)).toContain('motion.data_reel_source_missing');

    const relabeled = create();
    relabeled.layers.find(layer => layer.dataReelRole === 'source')!.name = 'Independently verified by ATLAS';
    expect(validateMotionComposition(relabeled).map(issue => issue.code)).toContain('motion.data_reel_source_changed');

    const deleted = create();
    deleted.layers = deleted.layers.filter(layer => layer.dataReelRole !== 'value');
    expect(validateMotionComposition(deleted).map(issue => issue.code)).toContain('motion.data_reel_count_mismatch');
  });

  it('integrates with the existing ProductionSpec review gate, not a parallel renderer', () => {
    const production = createEmptyProductionSpec({ id: 'production-1', now: '2026-11-07T00:00:00.000Z' });
    production.title = 'Quarterly facts';
    production.brief = 'Explain user-supplied research numbers and credit sources.';
    production.durationSeconds = 10;
    production.aspectRatio = '9:16';
    production.motionComposition = create();
    expect(validateProductionSpec(production).issues.filter(issue => issue.code.startsWith('motion.'))).toEqual([]);
    production.motionComposition.layers[1].sourceUrl = '';
    expect(validateProductionSpec(production).status).toBe('blocking');
  });
});
