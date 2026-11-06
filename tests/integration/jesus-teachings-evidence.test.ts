import { describe, expect, it } from 'vitest';
import { BIBLE_OS_SOURCES } from '../../apps/web/src/modules/knowledge/bible/bibleOsData';
import { JESUS_TEACHING_SEEDS } from '../../apps/web/src/modules/knowledge/bible/jesusTeachingData';

describe('ATLAS Jesus teaching seeds — evidence gates', () => {
  it('provides distinct traceable Gospel passages without invented scripture text', () => {
    expect(JESUS_TEACHING_SEEDS.length).toBeGreaterThanOrEqual(5);
    expect(new Set(JESUS_TEACHING_SEEDS.map(item => item.id)).size).toBe(JESUS_TEACHING_SEEDS.length);
    for (const item of JESUS_TEACHING_SEEDS) {
      expect(item.passage).toMatch(/^(Mark|Luke|Matthew|John) \d+:\d+/);
      expect(BIBLE_OS_SOURCES.some(source => source.id === item.sourceId)).toBe(true);
      expect(item.evidenceState).toBe('THEOLOGICAL_CLAIM');
      expect(item.status).toBe('curated_seed');
      expect(item.summary.length).toBeGreaterThan(25);
    }
  });
});
