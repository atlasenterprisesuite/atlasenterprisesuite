import { animalAtlasSeed } from '../../../../../../data/knowledge/animalAtlasSeed';
import type {
  AnimalEvidenceSource,
  AnimalEvidenceState,
  AnimalTaxon,
  AnimalTaxonomy
} from '../../../../../../packages/knowledge/animal-atlas';
import { atlasAuthorizedJson, getAtlasAccessToken } from '../../../lib/atlasSession';

export type AnimalAtlasDataSource = 'supabase_live' | 'repository_curated';

export type AnimalAtlasDataset = {
  source: AnimalAtlasDataSource;
  records: AnimalTaxon[];
  loadedAt: string;
};

type TaxonRow = {
  id: string;
  slug: string;
  scientific_name: string;
  common_names: string[] | null;
  rank: string;
  animal_group: string;
  taxonomy: AnimalTaxonomy;
  habitat: string;
  diet: string;
  reproduction: string;
  human_relationship: string;
  risks: string[] | null;
  conservation_status: string | null;
  medical_relevance: string | null;
  evidence_state: AnimalEvidenceState;
  myth_correction: string | null;
  purpose_interpretation: string | null;
  reviewed_at: string;
};

type RoleRow = {
  taxon_id: string;
  role: string;
};

type SourceRow = {
  taxon_id: string;
  title: string;
  organization: string;
  source_url: string;
  source_type: AnimalEvidenceSource['sourceType'];
  claim_scope: string;
  reviewed_at: string;
};

function normalizedTaxonomy(value: unknown): AnimalTaxonomy {
  const taxonomy = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  return {
    kingdom: String(taxonomy.kingdom || ''),
    phylum: String(taxonomy.phylum || ''),
    class: String(taxonomy.class || ''),
    order: String(taxonomy.order || ''),
    family: String(taxonomy.family || ''),
    genus: String(taxonomy.genus || ''),
    species: String(taxonomy.species || '')
  };
}

export function normalizeAnimalAtlasRows(
  taxaRows: TaxonRow[],
  roleRows: RoleRow[],
  sourceRows: SourceRow[]
): AnimalTaxon[] {
  const rolesByTaxon = new Map<string, string[]>();
  for (const row of roleRows) {
    const roles = rolesByTaxon.get(String(row.taxon_id)) || [];
    roles.push(String(row.role));
    rolesByTaxon.set(String(row.taxon_id), roles);
  }

  const sourcesByTaxon = new Map<string, AnimalEvidenceSource[]>();
  for (const row of sourceRows) {
    const sources = sourcesByTaxon.get(String(row.taxon_id)) || [];
    sources.push({
      title: String(row.title),
      organization: String(row.organization),
      url: String(row.source_url),
      sourceType: row.source_type,
      claimScope: String(row.claim_scope),
      reviewedAt: String(row.reviewed_at)
    });
    sourcesByTaxon.set(String(row.taxon_id), sources);
  }

  return taxaRows.map((row) => ({
    id: String(row.id),
    slug: String(row.slug),
    scientificName: String(row.scientific_name),
    commonNames: Array.isArray(row.common_names) ? row.common_names.map(String) : [],
    rank: 'species',
    group: String(row.animal_group),
    taxonomy: normalizedTaxonomy(row.taxonomy),
    habitat: String(row.habitat || ''),
    diet: String(row.diet || ''),
    reproduction: String(row.reproduction || ''),
    ecologicalRoles: rolesByTaxon.get(String(row.id)) || [],
    humanRelationship: String(row.human_relationship || ''),
    risks: Array.isArray(row.risks) ? row.risks.map(String) : [],
    conservationStatus: row.conservation_status ? String(row.conservation_status) : null,
    medicalRelevance: row.medical_relevance ? String(row.medical_relevance) : null,
    evidenceState: row.evidence_state,
    mythCorrection: row.myth_correction ? String(row.myth_correction) : null,
    purposeInterpretation: row.purpose_interpretation ? String(row.purpose_interpretation) : null,
    reviewedAt: String(row.reviewed_at),
    sources: sourcesByTaxon.get(String(row.id)) || []
  }));
}

export function resolveAnimalAtlasDataset(liveRecords?: AnimalTaxon[] | null): AnimalAtlasDataset {
  if (liveRecords && liveRecords.length > 0) {
    return {
      source: 'supabase_live',
      records: liveRecords,
      loadedAt: new Date().toISOString()
    };
  }

  return {
    source: 'repository_curated',
    records: animalAtlasSeed,
    loadedAt: new Date().toISOString()
  };
}

export async function getAnimalAtlasRecords(): Promise<AnimalAtlasDataset> {
  if (!getAtlasAccessToken()) return resolveAnimalAtlasDataset();

  try {
    const [taxaRows, roleRows, sourceRows] = await Promise.all([
      atlasAuthorizedJson<TaxonRow[]>('/rest/v1/knowledge_animal_taxa?select=id,slug,scientific_name,common_names,rank,animal_group,taxonomy,habitat,diet,reproduction,human_relationship,risks,conservation_status,medical_relevance,evidence_state,myth_correction,purpose_interpretation,reviewed_at&order=scientific_name.asc', { method: 'GET' }),
      atlasAuthorizedJson<RoleRow[]>('/rest/v1/knowledge_animal_roles?select=taxon_id,role&order=role.asc', { method: 'GET' }),
      atlasAuthorizedJson<SourceRow[]>('/rest/v1/knowledge_animal_sources?select=taxon_id,title,organization,source_url,source_type,claim_scope,reviewed_at&order=organization.asc,title.asc', { method: 'GET' })
    ]);

    return resolveAnimalAtlasDataset(normalizeAnimalAtlasRows(taxaRows, roleRows, sourceRows));
  } catch {
    return resolveAnimalAtlasDataset();
  }
}
