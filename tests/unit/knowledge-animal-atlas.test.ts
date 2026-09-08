import { describe, expect, it } from 'vitest';
import {
  animalGroupOptions,
  animalRoleOptions,
  filterAnimalTaxa,
  type AnimalTaxon
} from '../../packages/knowledge/animal-atlas';
import { animalAtlasSeed } from '../../data/knowledge/animalAtlasSeed';

const records: AnimalTaxon[] = [
  {
    id: 'lovebug',
    slug: 'common-lovebug',
    scientificName: 'Plecia nearctica',
    commonNames: ['Common lovebug', 'Lovebug'],
    rank: 'species',
    group: 'Insects',
    taxonomy: {
      kingdom: 'Animalia',
      phylum: 'Arthropoda',
      class: 'Insecta',
      order: 'Diptera',
      family: 'Bibionidae',
      genus: 'Plecia',
      species: 'Plecia nearctica'
    },
    habitat: 'Warm terrestrial habitats where larvae develop in decaying plant material.',
    diet: 'Larvae consume decaying vegetation; adults visit flowers and other plant resources.',
    reproduction: 'Sexual reproduction with paired adults and larval development in organic matter.',
    ecologicalRoles: ['nutrient recycling', 'detritivore'],
    humanRelationship: 'Seasonal nuisance fly; the larval stage contributes to decomposition.',
    risks: ['Nuisance swarms can accumulate around roads and vehicles.'],
    conservationStatus: null,
    medicalRelevance: 'Not represented as a human disease vector in the governed source baseline.',
    evidenceState: 'verified_source',
    reviewedAt: '2026-09-08',
    sources: [
      {
        title: 'Lovebugs, Plecia nearctica Hardy (Insecta: Diptera: Bibionidae)',
        organization: 'University of Florida IFAS Extension',
        url: 'https://ask.ifas.ufl.edu/publication/IN204',
        sourceType: 'institutional',
        claimScope: 'biology and ecological role',
        reviewedAt: '2026-09-08'
      }
    ]
  },
  {
    id: 'alligator',
    slug: 'american-alligator',
    scientificName: 'Alligator mississippiensis',
    commonNames: ['American alligator'],
    rank: 'species',
    group: 'Reptiles',
    taxonomy: {
      kingdom: 'Animalia',
      phylum: 'Chordata',
      class: 'Reptilia',
      order: 'Crocodylia',
      family: 'Alligatoridae',
      genus: 'Alligator',
      species: 'Alligator mississippiensis'
    },
    habitat: 'Freshwater wetlands.',
    diet: 'Carnivorous predator.',
    reproduction: 'Egg-laying reptile with nest guarding.',
    ecologicalRoles: ['predator', 'ecosystem engineer'],
    humanRelationship: 'Native wetland wildlife with ecological and conservation importance.',
    risks: ['Large wild individuals can be dangerous when approached or fed.'],
    conservationStatus: null,
    medicalRelevance: null,
    evidenceState: 'verified_source',
    reviewedAt: '2026-09-08',
    sources: []
  }
];

describe('ATLAS Knowledge Atlas animal domain', () => {
  it('searches common names, scientific names and taxonomy case-insensitively', () => {
    expect(filterAnimalTaxa(records, { search: 'LOVEBUG' }).map((record) => record.id)).toEqual(['lovebug']);
    expect(filterAnimalTaxa(records, { search: 'mississippiensis' }).map((record) => record.id)).toEqual(['alligator']);
    expect(filterAnimalTaxa(records, { search: 'bibionidae' }).map((record) => record.id)).toEqual(['lovebug']);
  });

  it('searches ecological roles', () => {
    expect(filterAnimalTaxa(records, { search: 'nutrient recycling' }).map((record) => record.id)).toEqual(['lovebug']);
  });

  it('composes group and ecological-role filters', () => {
    expect(filterAnimalTaxa(records, { group: 'Insects', role: 'detritivore' }).map((record) => record.id)).toEqual(['lovebug']);
    expect(filterAnimalTaxa(records, { group: 'Reptiles', role: 'detritivore' })).toEqual([]);
  });

  it('does not fabricate fallback rows for unknown filters', () => {
    expect(filterAnimalTaxa(records, { group: 'Mammals' })).toEqual([]);
    expect(filterAnimalTaxa(records, { role: 'pollinator' })).toEqual([]);
  });

  it('derives deterministic sorted filter options from loaded records', () => {
    expect(animalGroupOptions(records)).toEqual(['Insects', 'Reptiles']);
    expect(animalRoleOptions(records)).toEqual(['detritivore', 'ecosystem engineer', 'nutrient recycling', 'predator']);
  });

  it('keeps the lovebug seed evidence-backed and myth-corrected', () => {
    const lovebug = animalAtlasSeed.find((record) => record.slug === 'common-lovebug');
    expect(lovebug?.scientificName).toBe('Plecia nearctica');
    expect(lovebug?.taxonomy).toEqual({
      kingdom: 'Animalia',
      phylum: 'Arthropoda',
      class: 'Insecta',
      order: 'Diptera',
      family: 'Bibionidae',
      genus: 'Plecia',
      species: 'Plecia nearctica'
    });
    expect(lovebug?.ecologicalRoles).toContain('nutrient recycling');
    expect(lovebug?.mythCorrection).toMatch(/not created|not engineered|myth/i);
    expect(lovebug?.sources.some((source) => source.organization.includes('University of Florida'))).toBe(true);
    expect(lovebug?.sources.some((source) => /GBIF|Catalogue of Life/.test(source.organization))).toBe(true);
  });

  it('ships a representative, source-backed foundation without claiming global completeness', () => {
    expect(animalAtlasSeed).toHaveLength(10);
    expect(animalAtlasSeed.every((record) => record.sources.length > 0)).toBe(true);
    expect(new Set(animalAtlasSeed.map((record) => record.group)).size).toBeGreaterThanOrEqual(8);
  });
});
