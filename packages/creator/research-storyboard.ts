import type { ProductionSpec } from './types.ts';

export type ResearchDomain = 'science' | 'history' | 'finance' | 'geography';
export type ResearchSource = { id: string; url: string; title: string; sha256: string; rights: string };
export type ResearchScene = { id: string; title: string; narration: string; classification: 'fact' | 'hypothesis' | 'projection' | 'reconstruction'; sourceIds: string[] };
export type ResearchInput = { domain: ResearchDomain; sources: ResearchSource[]; scenes: ResearchScene[] };

function requireText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function buildResearchStoryboard(input: ResearchInput) {
  if (!['science','history','finance','geography'].includes(input.domain)) throw new Error('unsupported_research_domain');
  if (!Array.isArray(input.sources) || !Array.isArray(input.scenes) || !input.scenes.length || input.scenes.length > 100 || input.sources.length > 500) throw new Error('invalid_storyboard_size');
  const sources = new Map<string, ResearchSource>();
  for (const source of input.sources) {
    if (!requireText(source.id) || sources.has(source.id) || !requireText(source.title) || !requireText(source.rights) || !/^[a-f0-9]{64}$/i.test(source.sha256)) throw new Error('invalid_research_source');
    const url = new URL(source.url);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('invalid_source_url');
    sources.set(source.id, { ...source });
  }
  const ids = new Set<string>();
  const scenes = input.scenes.map(scene => {
    if (!requireText(scene.id) || ids.has(scene.id) || !requireText(scene.title) || !requireText(scene.narration) || scene.narration.length > 4000 || !['fact','hypothesis','projection','reconstruction'].includes(scene.classification)) throw new Error('invalid_research_scene');
    ids.add(scene.id);
    if (!Array.isArray(scene.sourceIds) || !scene.sourceIds.length || new Set(scene.sourceIds).size !== scene.sourceIds.length) throw new Error('scene_sources_required');
    return { ...scene, sourceIds: [...scene.sourceIds], sources: scene.sourceIds.map(id => {
      const source = sources.get(id);
      if (!source) throw new Error('unknown_scene_source');
      return { ...source };
    }) };
  });
  // A supplied digest is not proof that bytes or claims have been verified.
  return { domain: input.domain, provider: 'atlas-native' as const, verification: 'unverified' as const, scenes };
}

export function attachResearchStoryboard(spec: ProductionSpec, input: ResearchInput): ProductionSpec {
  const storyboard = buildResearchStoryboard(input);
  const known = new Set(spec.scenes.map(scene => scene.id));
  if (known.size !== spec.scenes.length || known.size !== storyboard.scenes.length || storyboard.scenes.some(scene => !known.has(scene.id))) throw new Error('production_scene_mismatch');
  const byId = new Map(storyboard.scenes.map(scene => [scene.id, scene]));
  return { ...spec, status: 'draft', providerPreference: null,
    audioPlan: { ...spec.audioPlan, dialogue: [...spec.scenes].sort((a,b) => a.startSecond-b.startSecond).map(scene => {
      const item = byId.get(scene.id)!;
      return '[' + item.classification + '] ' + item.narration;
    }) },
    providerOverrides: { ...spec.providerOverrides, researchStoryboard: storyboard }
  };
}
