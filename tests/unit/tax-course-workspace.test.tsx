import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TAX_LESSONS, gradeTaxLesson } from '../../apps/web/src/modules/tax/taxCourseCatalog';
import { TaxCourseWorkspace, TaxLessonView } from '../../apps/web/src/modules/tax/TaxCourseWorkspace';
import { loadTaxLearningProgress, resolveTaxLearningContext, saveTaxLearningAttempt } from '../../apps/web/src/modules/tax/taxLearningRepository';
vi.mock('../../apps/web/src/modules/tax/taxLearningRepository', () => ({
  loadTaxLearningProgress: vi.fn(), resolveTaxLearningContext: vi.fn(), saveTaxLearningAttempt: vi.fn()
}));
const identity = { userId: 'user-a', orgId: 'org-a' };
beforeEach(() => {
  cleanup(); vi.resetAllMocks();
  vi.mocked(resolveTaxLearningContext).mockResolvedValue(identity);
  vi.mocked(loadTaxLearningProgress).mockResolvedValue([]);
  vi.mocked(saveTaxLearningAttempt).mockResolvedValue();
});
afterEach(cleanup);
function submitLesson(lesson = TAX_LESSONS[0]) {
  lesson.questions.forEach(q => fireEvent.change(screen.getByLabelText(q.prompt), { target: { value: String(q.expected) } }));
  fireEvent.submit(screen.getByRole('button', { name: 'Comprobar y guardar intento' }).closest('form')!);
}
describe('Complete tax curriculum', () => {
  it('ships all twenty linked lessons and forty-one questions at once', () => {
    expect(TAX_LESSONS).toHaveLength(20);
    expect(new Set(TAX_LESSONS.map(l => l.id)).size).toBe(20);
    expect(TAX_LESSONS.reduce((sum,l) => sum+l.questions.length,0)).toBe(41);
    for (const lesson of TAX_LESSONS) {
      expect(lesson.mappings.length).toBeGreaterThan(0);
      expect(lesson.sources.every(s => s.startsWith('https://www.irs.gov/'))).toBe(true);
      expect(gradeTaxLesson(lesson,lesson.questions.map(q => String(q.expected))).every(Boolean)).toBe(true);
    }
  });
  it('rejects missing, blank and non-finite answers', () => {
    for (const answers of [[], ['', '2100'], ['NaN', '2100'], ['Infinity', '2100']]) {
      expect(() => gradeTaxLesson(TAX_LESSONS[0],answers)).toThrow();
    }
    expect(gradeTaxLesson(TAX_LESSONS[0],['28000','0'])).toEqual([true,false]);
  });
  it('checks Schedule SE with rounded components and half-tax adjustment', () => {
    const lesson = TAX_LESSONS.find(l => l.id === 'se')!;
    expect(lesson.questions.map(q => q.expected)).toEqual([18470,2826,1413]);
    expect(Math.round(18470*.124)+Math.round(18470*.029)).toBe(2826);
  });
  it('withholds feedback until submission and hides it on edits', async () => {
    const onAttempt = vi.fn().mockResolvedValue(undefined);
    render(<TaxLessonView lesson={TAX_LESSONS[0]} busy={false} onAttempt={onAttempt} />);
    expect(screen.queryByRole('status')).toBeNull();
    submitLesson();
    await waitFor(() => expect(onAttempt).toHaveBeenCalledOnce());
    expect(screen.getByRole('status').textContent).toContain('2/2 · 100%');
    fireEvent.change(screen.getByLabelText(TAX_LESSONS[0].questions[0].prompt), {target:{value:'0'}});
    expect(screen.queryByRole('status')).toBeNull();
  });
  it('loads account progress and resumes the first undominated lesson', async () => {
    vi.mocked(loadTaxLearningProgress).mockResolvedValue([{lesson_id:'intake',attempts:2,best_percent:100,last_attempt:'2026-10-08'}]);
    render(<TaxCourseWorkspace />);
    await screen.findByText(/Lecciones dominadas: 1\/20/);
    expect(screen.getByRole('heading',{level:2}).textContent).toContain('02 ·');
    expect(screen.getAllByRole('button',{pressed:true})).toHaveLength(1);
  });
  it('does not imply zero progress when the backend is unavailable', async () => {
    vi.mocked(loadTaxLearningProgress).mockRejectedValue(new Error('offline'));
    render(<TaxCourseWorkspace />);
    await screen.findByText(/No se pudo cargar el progreso/);
    expect(screen.queryByText(/Lecciones dominadas:/)).toBeNull();
    expect(screen.getByText('Progreso de cuenta aún no confirmado.')).toBeTruthy();
  });
  it('retains a failed attempt across navigation and retries the same UUID', async () => {
    vi.mocked(saveTaxLearningAttempt).mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    render(<TaxCourseWorkspace />);
    await screen.findByText(/Progreso cargado de tu cuenta/);
    submitLesson();
    await screen.findByText(/No se confirmó el guardado/);
    const original = vi.mocked(saveTaxLearningAttempt).mock.calls[0][1];
    fireEvent.click(screen.getByRole('button',{name:'Siguiente'}));
    fireEvent.click(screen.getByRole('button',{name:'Reintentar guardado pendiente'}));
    await screen.findByText(/Intento confirmado y progreso sincronizado/);
    expect(vi.mocked(saveTaxLearningAttempt).mock.calls[1]).toEqual([identity,original]);
  });
  it('clears progress and quiz answers on a session change', async () => {
    render(<TaxCourseWorkspace />);
    await screen.findByText(/Progreso cargado de tu cuenta/);
    fireEvent.change(screen.getByLabelText(TAX_LESSONS[0].questions[0].prompt),{target:{value:'123'}});
    vi.mocked(resolveTaxLearningContext).mockResolvedValue({userId:'user-b',orgId:'org-b'});
    fireEvent(window,new Event('atlas-session-changed'));
    await waitFor(() => expect(screen.getByLabelText(TAX_LESSONS[0].questions[0].prompt)).toHaveProperty('value',''));
    expect(resolveTaxLearningContext).toHaveBeenCalledTimes(2);
  });
});
