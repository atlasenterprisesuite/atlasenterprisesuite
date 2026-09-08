import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(process.cwd(), 'supabase/migrations/20260908_knowledge_animal_atlas.sql');
const migration = readFileSync(migrationPath, 'utf8');

const tables = ['knowledge_animal_taxa', 'knowledge_animal_roles', 'knowledge_animal_sources'];

describe('ATLAS Animal Kingdom Supabase contract', () => {
  it('creates all governed knowledge tables with row level security', () => {
    for (const table of tables) {
      expect(migration).toMatch(new RegExp(`create table if not exists public\\.${table}`, 'i'));
      expect(migration).toMatch(new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
    }
  });

  it('allows authenticated users to read published knowledge only', () => {
    expect(migration).toMatch(/to authenticated[\s\S]*using \(is_published = true\)/i);
    expect(migration).toMatch(/knowledge_animal_roles[\s\S]*knowledge_animal_taxa[\s\S]*is_published = true/i);
    expect(migration).toMatch(/knowledge_animal_sources[\s\S]*knowledge_animal_taxa[\s\S]*is_published = true/i);
  });

  it('does not create ordinary browser mutation policies', () => {
    expect(migration).not.toMatch(/for insert[\s\S]*to authenticated/i);
    expect(migration).not.toMatch(/for update[\s\S]*to authenticated/i);
    expect(migration).not.toMatch(/for delete[\s\S]*to authenticated/i);
    expect(migration).toMatch(/revoke all on public\.knowledge_animal_taxa from anon/i);
    expect(migration).toMatch(/grant select on public\.knowledge_animal_taxa to authenticated/i);
  });

  it('constrains evidence state and source type to governed values', () => {
    expect(migration).toMatch(/verified_source/i);
    expect(migration).toMatch(/curated_reference/i);
    expect(migration).toMatch(/needs_review/i);
    expect(migration).toMatch(/primary_research/i);
    expect(migration).toMatch(/taxonomic/i);
  });
});
