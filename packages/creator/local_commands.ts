import { createEmptyScene, createEmptyShot } from './defaults';
import type { AspectRatio, ProductionSpec, SceneSpec } from './types';

type LocalAction =
  | { type: 'root.patch'; patch: Partial<Pick<ProductionSpec, 'title' | 'brief' | 'aspectRatio' | 'audioPlan' | 'audioEnabled'>> }
  | { type: 'scene.add'; scene: SceneSpec }
  | { type: 'provider.select'; providerId: null };
export type LocalCommandPlan = { actions: LocalAction[]; summary: string };

/** Explicit, deterministic editing grammar. No model, fetch, publishing or render side effects. */
export function planDirectorCommand(spec: ProductionSpec, input: string): LocalCommandPlan {
  const reject = (summary: string): LocalCommandPlan => ({ actions: [], summary });
  if (!input.trim() || input.length > 4000) return reject('Enter one command, up to 4,000 characters.');
  const match = /^([^:\n]+):\s*([\s\S]+)$/.exec(input.trim());
  if (!match || !match[2].trim()) return reject('Use Title, Brief, Format, Narration, Scene or Mode followed by a colon.');
  const key = match[1].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const value = match[2].trim();
  if (['title', 'titulo', 'brief', 'idea'].includes(key)) {
    const field = ['title', 'titulo'].includes(key) ? 'title' : 'brief';
    return { actions: [{ type: 'root.patch', patch: { [field]: value } }], summary: `Update ${field}: ${value}` };
  }
  if (['format', 'formato'].includes(key)) {
    const ratios: Record<string, AspectRatio> = { vertical: '9:16', horizontal: '16:9', square: '1:1', cuadrado: '1:1', '9:16': '9:16', '16:9': '16:9', '1:1': '1:1' };
    const ratio = ratios[value.toLowerCase()];
    if (!ratio) return reject('Supported formats: vertical, horizontal, square, 9:16, 16:9, 1:1.');
    return { actions: [{ type: 'root.patch', patch: { aspectRatio: ratio } }], summary: `Set format to ${ratio}. Existing motion compositions keep their own canvas; review them in Motion Designer.` };
  }
  if (['narration', 'narracion'].includes(key)) return {
    actions: [{ type: 'root.patch', patch: { audioEnabled: true, audioPlan: { ...spec.audioPlan, dialogue: [value] } } }],
    summary: `Replace narration with: ${value}`
  };
  if (['mode', 'modo'].includes(key) && value.toLowerCase() === 'local') return {
    actions: [{ type: 'provider.select', providerId: null }], summary: 'Clear the external provider selection. Native runtime readiness and render permissions still apply.'
  };
  if (['scene', 'escena'].includes(key)) {
    const sceneMatch = /^(.+)\|\s*(\d+(?:\.\d+)?)$/.exec(value);
    if (!sceneMatch || !sceneMatch[1].trim()) return reject('Use Scene: description | seconds.');
    const seconds = Number(sceneMatch[2]);
    const start = Math.max(0, ...spec.scenes.map(scene => scene.endSecond));
    const end = start + seconds;
    if (!Number.isFinite(end) || seconds <= 0 || end > spec.durationSeconds) return reject('The scene must fit within the production duration. Set duration in Creative Brief first.');
    const title = sceneMatch[1].trim();
    const scene = { ...createEmptyScene(), title, description: title, startSecond: start, endSecond: end,
      shots: [{ ...createEmptyShot({ order: 1 }), title, action: title, startSecond: start, endSecond: end, camera: { ...spec.cameraDefaults } }] };
    return { actions: [{ type: 'scene.add', scene }], summary: `Append scene “${title}”, ${start}–${end}s. Review subjects, references and continuity before rendering.` };
  }
  return reject('Unsupported command. This local editor uses explicit commands; it does not invent content or call a paid AI service.');
}
