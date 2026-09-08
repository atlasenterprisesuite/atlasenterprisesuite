export type AnimalEvidenceState = 'verified_source' | 'curated_reference' | 'needs_review';

export type AnimalEvidenceSource = {
  title: string;
  organization: string;
  url: string;
  sourceType: 'institutional' | 'taxonomic' | 'primary_research' | 'conservation' | 'reference';
  claimScope: string;
  reviewedAt: string;
};

export type AnimalTaxonomy = {
  kingdom: string;
  phylum: string;
  class: string;
  order: string;
  family: string;
  genus: string;
  species: string;
};

export type AnimalTaxon = {
  id: string;
  slug: string;
  scientificName: string;
  commonNames: string[];
  rank: 'species';
  group: string;
  taxonomy: AnimalTaxonomy;
  habitat: string;
  diet: string;
  reproduction: string;
  ecologicalRoles: string[];
  humanRelationship: string;
  risks: string[];
  conservationStatus: string | null;
  medicalRelevance: string | null;
  evidenceState: AnimalEvidenceState;
  reviewedAt: string;
  sources: AnimalEvidenceSource[];
  mythCorrection?: string | null;
  purposeInterpretation?: string | null;
};

export type AnimalAtlasFilter = {
  search?: string;
  group?: string;
  role?: string;
};

function normalize(value: string | null | undefined) {
  return String(value || '').trim().toLocaleLowerCase();
}

function searchDocument(record: AnimalTaxon) {
  return [
    ...record.commonNames,
    record.scientificName,
    record.group,
    ...Object.values(record.taxonomy),
    ...record.ecologicalRoles,
    record.habitat,
    record.diet,
    record.humanRelationship
  ].join(' ').toLocaleLowerCase();
}

export function filterAnimalTaxa(records: AnimalTaxon[], filter: AnimalAtlasFilter = {}) {
  const search = normalize(filter.search);
  const group = normalize(filter.group);
  const role = normalize(filter.role);

  return records.filter((record) => {
    if (search && !searchDocument(record).includes(search)) return false;
    if (group && normalize(record.group) !== group) return false;
    if (role && !record.ecologicalRoles.some((item) => normalize(item) === role)) return false;
    return true;
  });
}

function sortedUnique(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function animalGroupOptions(records: AnimalTaxon[]) {
  return sortedUnique(records.map((record) => record.group));
}

export function animalRoleOptions(records: AnimalTaxon[]) {
  return sortedUnique(records.flatMap((record) => record.ecologicalRoles));
}
