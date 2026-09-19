import type { AviationCategory, AviationConcept } from './aviation-model';

export type AviationCatalogFilters = {
  query?: string;
  category?: AviationCategory | 'all';
};

export function filterAviationConcepts(
  concepts: readonly AviationConcept[],
  filters: AviationCatalogFilters = {}
): AviationConcept[] {
  const query = filters.query?.trim().toLocaleLowerCase() ?? '';
  const category = filters.category && filters.category !== 'all' ? filters.category : null;

  return concepts.filter((aircraft) => {
    const categoryMatches = category ? aircraft.category === category : true;
    if (!categoryMatches) return false;
    if (!query) return true;

    const haystack = [
      aircraft.id,
      aircraft.modelName,
      aircraft.category,
      aircraft.categoryLabel,
      aircraft.intendedUse,
      aircraft.summary
    ].join(' ').toLocaleLowerCase();

    return haystack.includes(query);
  });
}
