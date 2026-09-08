import { describe, expect, it } from 'vitest';
import {
  normalizeAnimalAtlasRows,
  resolveAnimalAtlasDataset
} from '../../apps/web/src/modules/knowledge/animals/animalAtlasData';

const taxonRow = {
  id: '11111111-1111-1111-1111-111111111111',
  slug: 'common-lovebug',
  scientific_name: 'Plecia nearctica',
  common_names: ['Common lovebug', 'Lovebug'],
  rank: 'species',
  animal_group: 'Insects',
  taxonomy: {
    kingdom: 'Animalia',
    phylum: 'Arthropoda',
    class: 'Insecta',
    order: 'Diptera',
    family: 'Bibionidae',
    genus: 'Plecia',
    species: 'Plecia nearctica'
  },
  habitat: 'Organic material and warm terrestrial habitats.',
  diet: 'Larvae consume decaying vegetation.',
  reproduction: 'Sexual reproduction with larval development in organic matter.',
  human_relationship: 'Seasonal nuisance; larvae recycle organic matter.',
  risks: ['Seasonal nuisance swarms.'],
  conservation_status: null,
  medical_relevance: null,
  evidence_state: 'verified_source',
  myth_correction: 'The laboratory-created mosquito-control story is a myth.',
  purpose_interpretation: null,
  reviewed_at: '2026-09-08'
};

const roleRows = [
  { taxon_id: taxonRow.id, role: 'nutrient recycling' },
  { taxon_id: taxonRow.id, role: 'detritivore' }
];

const sourceRows = [
  {
    taxon_id: taxonRow.id,
    title: 'Lovebugs, Plecia nearctica Hardy (Insecta: Diptera: Bibionidae)',
    organization: 'University of Florida IFAS Extension',
    source_url: 'https://ask.ifas.ufl.edu/publication/IN204',
    source_type: 'institutional',
    claim_scope: 'biology and ecological role',
    reviewed_at: '2026-09-08'
  }
];

describe('ATLAS Animal Kingdom data adapter', () => {
  it('normalizes Supabase rows into the governed animal domain', () => {
    const records = normalizeAnimalAtlasRows([taxonRow], roleRows, sourceRows);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      slug: 'common-lovebug',
      scientificName: 'Plecia nearctica',
      group: 'Insects',
      ecologicalRoles: ['nutrient recycling', 'detritivore'],
      evidenceState: 'verified_source'
    });
    expect(records[0].sources[0].url).toBe('https://ask.ifas.ufl.edu/publication/IN204');
  });

  it('reports live state only when live records actually exist', () => {
    const liveRecords = normalizeAnimalAtlasRows([taxonRow], roleRows, sourceRows);
    const dataset = resolveAnimalAtlasDataset(liveRecords);
    expect(dataset.source).toBe('supabase_live');
    expect(dataset.records).toHaveLength(1);
  });

  it('falls back truthfully to repository-curated evidence when live data is absent', () => {
    const dataset = resolveAnimalAtlasDataset([]);
    expect(dataset.source).toBe('repository_curated');
    expect(dataset.records).toHaveLength(10);
    expect(dataset.records.some((record) => record.slug === 'common-lovebug')).toBe(true);
  });
});
