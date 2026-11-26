import { validateAiCurriculum } from './aiCurriculum';

export interface AiProgressScope {
  userId: string;
  organizationId: string;
  enrollmentId: string;
}
export interface AiProgressEvidence extends AiProgressScope {
  moduleId: string;
  moduleVersion: string;
  evidenceId: string;
  passed: boolean;
}
export interface AiProgressProjection {
  completed: number;
  total: number;
  percent: number;
  modules: ReadonlyArray<{ id: string; status: 'completed' | 'available' | 'locked' }>;
}
const nonempty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

/** Pure read-only projection. Caller MUST authenticate and load authoritative
 * enrollment and assessment evidence from trusted server storage.
 * Never accept evidence or scope from an untrusted client as authoritative.
 * Does not authorize module access, persist progress or issue credentials.
 */
export function projectAiProgress(catalog: unknown, scope: AiProgressScope, evidence: unknown): AiProgressProjection {
  validateAiCurriculum(catalog);
  if (!scope || !nonempty(scope.userId) || !nonempty(scope.organizationId) || !nonempty(scope.enrollmentId) ||
      !Array.isArray(evidence) || evidence.length > 100000) throw new Error('Invalid progress input');
  const modules = new Map(catalog.map(m => [m.id, m]));
  const seen = new Set<string>();
  const completed = new Set<string>();
  for (const e of evidence) {
    if (!e || e.userId !== scope.userId || e.organizationId !== scope.organizationId ||
        e.enrollmentId !== scope.enrollmentId || !nonempty(e.moduleId) || !nonempty(e.evidenceId) ||
        typeof e.passed !== 'boolean' || seen.has(e.evidenceId)) throw new Error('Invalid progress evidence');
    const module = modules.get(e.moduleId);
    if (!module || e.moduleVersion !== module.version) throw new Error('Invalid module version');
    seen.add(e.evidenceId);
    if (e.passed) completed.add(e.moduleId);
  }
  for (const id of completed) {
    const module = modules.get(id);
    if (!module || !module.prerequisites.every(p => completed.has(p))) throw new Error('Missing prerequisite evidence');
  }
  return {
    completed: completed.size,
    total: catalog.length,
    percent: (completed.size / catalog.length) * 100,
    modules: catalog.map(m => ({
      id: m.id,
      status: completed.has(m.id) ? 'completed' : m.prerequisites.every(p => completed.has(p)) ? 'available' : 'locked'
    }))
  };
}
