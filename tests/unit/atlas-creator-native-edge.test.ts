import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  resolve(process.cwd(), 'supabase/functions/atlas-creator-native/index.ts'),
  'utf8'
);

describe('atlas-creator-native edge contract', () => {
  it('stays versioned, zero-cost, permission-gated and audited', () => {
    for (const token of [
      'ATLAS_NATIVE_COMPOSER_URL',
      'ATLAS_NATIVE_COMPOSER_TOKEN',
      "'creator.generate'",
      'expected_version',
      "from('creator_generation_jobs')",
      "from('creator_assets')",
      "'atlas-native'",
      'writeCreatorAudit'
    ]) {
      expect(source).toContain(token);
    }
    expect(source.toLowerCase()).not.toMatch(/heygen|descript/);
  });

  it('uses the persisted production narration and rejects stale versions', () => {
    expect(source).toContain('spec.audioPlan.dialogue');
    expect(source).toContain('version_conflict');
    expect(source).toContain('validateProductionSpec(spec)');
  });
});
