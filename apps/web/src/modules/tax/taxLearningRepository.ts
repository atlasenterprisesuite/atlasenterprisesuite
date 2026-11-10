import { atlasAuthorizedJson, getActiveAtlasOrganization, getAtlasAccessToken } from '../../lib/atlasSession';
import { TAX_COURSE_VERSION, TAX_LESSONS } from './taxCourseCatalog';

export type TaxLearningContext = { userId: string; orgId: string };
export type TaxLearningProgress = { lesson_id: string; attempts: number; best_percent: number; last_attempt: string }[];

export async function resolveTaxLearningContext(): Promise<TaxLearningContext> {
  if (!getAtlasAccessToken()) throw new Error('Inicia sesión para guardar progreso.');
  const [user, org] = await Promise.all([
    atlasAuthorizedJson<{ id: string }>('/auth/v1/user', { method: 'GET' }),
    getActiveAtlasOrganization()
  ]);
  if (!user.id || !org.id) throw new Error('Identidad u organización no verificada.');
  return { userId: user.id, orgId: org.id };
}

async function confirmContext(context: TaxLearningContext) {
  const current = await resolveTaxLearningContext();
  if (current.userId !== context.userId || current.orgId !== context.orgId) throw new Error('La sesión cambió. Recarga el curso antes de guardar.');
}

export async function loadTaxLearningProgress(context: TaxLearningContext): Promise<TaxLearningProgress> {
  await confirmContext(context);
  const rows = await atlasAuthorizedJson<TaxLearningProgress>('/rest/v1/rpc/atlas_tax_learning_progress', {
    method: 'POST', body: JSON.stringify({ p_org_id: context.orgId, p_course_version: TAX_COURSE_VERSION })
  });
  if (!Array.isArray(rows)) throw new Error('Respuesta de progreso inválida.');
  return rows.filter(row => TAX_LESSONS.some(lesson => lesson.id === row.lesson_id));
}

export async function saveTaxLearningAttempt(context: TaxLearningContext, attempt: { id: string; lessonId: string; correct: number; total: number }): Promise<void> {
  const lesson = TAX_LESSONS.find(item => item.id === attempt.lessonId);
  if (!lesson || attempt.total !== lesson.questions.length || !Number.isInteger(attempt.correct) || attempt.correct < 0 || attempt.correct > attempt.total) throw new Error('Intento inválido.');
  await confirmContext(context);
  // Stable attempt UUID makes explicit retries idempotent after an ambiguous network failure.
  await atlasAuthorizedJson('/rest/v1/atlas_tax_learning_attempts?on_conflict=id', {
    method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify({
      id: attempt.id, org_id: context.orgId, user_id: context.userId, course_version: TAX_COURSE_VERSION,
      lesson_id: attempt.lessonId, correct_count: attempt.correct, total_count: attempt.total
    })
  });
}
