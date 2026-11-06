import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { BIBLE_OS_SOURCES } from '../../apps/web/src/modules/knowledge/bible/bibleOsData';
import { JESUS_TIMELINE_SEEDS } from '../../apps/web/src/modules/knowledge/bible/jesusTimelineData';
import { JESUS_TEACHING_SEEDS } from '../../apps/web/src/modules/knowledge/bible/jesusTeachingData';

describe('Bible OS Jesus timeline UI evidence contract', () => {
  it('links ordered Gospel events to curated source records without claiming a precise chronology', () => {
    expect(JESUS_TIMELINE_SEEDS.map(item => item.order)).toEqual([1, 2, 3, 4, 5, 6]);
    for (const item of JESUS_TIMELINE_SEEDS) {
      expect(item.evidenceState).toBe('THEOLOGICAL_CLAIM');
      expect(item.status).toBe('curated_seed');
      expect(BIBLE_OS_SOURCES.some(source => source.id === item.sourceId)).toBe(true);
      expect(item.passage).toMatch(/^(Mark|Matthew|Luke|John)/);
    }
  });
  it('exposes an accessible opt-in view with both seed collections', () => {
    const page = readFileSync('apps/web/src/modules/knowledge/bible/BibleOSPage.tsx', 'utf8');
    expect(page).toContain("id: 'jesus', label: 'Life & Teachings of Jesus'");
    expect(page).toContain("view === 'jesus' ? <JesusLifePanel />");
    expect(page).toContain('aria-label="Jesus timeline"');
    expect(page).toContain('aria-label="Teachings of Jesus"');
    expect(page).toContain('not a verified absolute chronology');
    expect(JESUS_TEACHING_SEEDS.length).toBeGreaterThan(0);
  });
});
