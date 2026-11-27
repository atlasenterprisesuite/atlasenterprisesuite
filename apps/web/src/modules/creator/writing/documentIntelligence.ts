// Pure local operations. No provider call, persistence or external effects.
export function findDocumentMatches(source: string, query: string): number[] {
  if (!query) return [];
  const matches: number[] = [];
  let from = 0;
  while (matches.length < 200) {
    const index = source.indexOf(query, from);
    if (index === -1) break;
    matches.push(index);
    from = index + query.length;
  }
  return matches;
}

export function canApplyDocumentDraft(snapshot: string | null, current: string, draft: string): boolean {
  return snapshot !== null && snapshot === current && draft.trim().length > 0;
}
