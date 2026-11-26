import { describe, expect, it } from 'vitest';
import { aiCurriculum } from '../../packages/learning/aiCurriculum';
import { projectAiProgress } from '../../packages/learning/aiLearningProgress';
const scope = { userId: 'u1', organizationId: 'o1', enrollmentId: 'e1' };
const record = { ...scope, moduleId: 'foundation', moduleVersion: '1.0.0', evidenceId: 'ev1', passed: true };
describe('AI learning progress projection', () => {
  it('opens only the first module initially', () => {
    const p = projectAiProgress(aiCurriculum, scope, []);
    expect(p.completed).toBe(0);
    expect(p.modules.filter(m => m.status === 'available').map(m => m.id)).toEqual(['foundation']);
  });
  it('unlocks the next module after trusted completion', () => {
    const p = projectAiProgress(aiCurriculum, scope, [record]);
    expect(p.completed).toBe(1);
    expect(p.modules[1].status).toBe('available');
  });
  it('rejects foreign scope', () => {
    for (const key of ['organizationId','userId','enrollmentId'] as const)
      expect(() => projectAiProgress(aiCurriculum, scope, [{ ...record, [key]: 'other' }])).toThrow();
  });
  it('rejects stale versions and unknown modules', () => {
    expect(() => projectAiProgress(aiCurriculum, scope, [{ ...record, moduleVersion: '0.0.1' }])).toThrow();
    expect(() => projectAiProgress(aiCurriculum, scope, [{ ...record, moduleId: 'unknown' }])).toThrow();
  });
  it('rejects duplicated evidence and premature completion', () => {
    expect(() => projectAiProgress(aiCurriculum, scope, [record, record])).toThrow();
    expect(() => projectAiProgress(aiCurriculum, scope, [{ ...record, moduleId: 'prompts' }])).toThrow();
  });
  it('does not count failed assessment', () => {
    expect(projectAiProgress(aiCurriculum, scope, [{ ...record, passed: false }]).completed).toBe(0);
  });
  it('rejects malformed evidence and empty identity', () => {
    expect(() => projectAiProgress(aiCurriculum, scope, [{ ...record, passed: 'true' }])).toThrow();
    expect(() => projectAiProgress(aiCurriculum, { ...scope, userId: '' }, [])).toThrow();
  });
});
