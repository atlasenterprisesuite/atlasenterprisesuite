import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { BIBLE_OS_SOURCES } from '../../apps/web/src/modules/knowledge/bible/bibleOsData';
import { JESUS_TEACHING_SEEDS } from '../../apps/web/src/modules/knowledge/bible/jesusTeachingData';
import { JESUS_TIMELINE_SEEDS } from '../../apps/web/src/modules/knowledge/bible/jesusTimelineData';

const seeds = [...JESUS_TEACHING_SEEDS, ...JESUS_TIMELINE_SEEDS];
const sourceIds = new Set(BIBLE_OS_SOURCES.map(source => source.id));

function validateSeed(seed: { sourceId: string; evidenceState: string; passage: string }) {
  if (!sourceIds.has(seed.sourceId)) return false;
  if (seed.evidenceState !== 'THEOLOGICAL_CLAIM') return false;
  return /^(Mark|Luke|Matthew|John)\s+\d/.test(seed.passage);
}

describe('Jesus Bible OS negative evidence and consent gates', () => {
  it('rejects unknown institutional sources, historical certainty and missing passage identifiers', () => {
    expect(seeds.every(validateSeed)).toBe(true);
    expect(validateSeed({ ...seeds[0], sourceId: 'unknown-source' })).toBe(false);
    expect(validateSeed({ ...seeds[0], evidenceState: 'DIRECT_WITNESS' })).toBe(false);
    expect(validateSeed({ ...seeds[0], passage: '' })).toBe(false);
  });

  it('keeps faith study opt-in and explicitly labels the source registry as non-passage-specific', () => {
    const page = readFileSync('apps/web/src/modules/knowledge/bible/BibleOSPage.tsx', 'utf8');
    expect(page).toContain("useState<BibleOSView>('overview')");
    expect(page).toContain("view === 'jesus' ? <JesusLifePanel />");
    expect(page).toContain('Institutional research entry point, not passage-level verification.');
    expect(page).toContain('aria-pressed={view === item.id}');
    expect(page).toContain('aria-labelledby="bible-os-jesus-heading"');
  });
});
