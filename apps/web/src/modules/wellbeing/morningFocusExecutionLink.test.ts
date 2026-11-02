import { describe, expect, it } from 'vitest';
import { executionLinkTarget, type MorningFocusExecutionLink } from './morningFocusExecutionLink';

const link: MorningFocusExecutionLink = {
  workflowId: '123e4567-e89b-42d3-a456-426614174000',
  taskId: '123e4567-e89b-42d3-a456-426614174001',
  record: {
    day: '2026-11-02',
    intention: 'Terminar Atlas',
    action: 'Revisar pruebas',
    evidence: 'Resultado comprobado',
    completed: true
  }
};

describe('Morning Focus read-only execution bridge', () => {
  it('rejects missing or invalid workflow identifiers', () => {
    expect(executionLinkTarget({ ...link, workflowId: '' })).toBeNull();
    expect(executionLinkTarget({ ...link, workflowId: '../other' })).toBeNull();
    expect(executionLinkTarget({ ...link, taskId: 'not-a-uuid' })).toBeNull();
  });

  it('does not link unverified completion', () => {
    expect(executionLinkTarget({ ...link, record: { ...link.record, completed: false } })).toBeNull();
    expect(executionLinkTarget({ ...link, record: { ...link.record, evidence: '' } })).toBeNull();
  });

  it('returns a deterministic path only for a validated reference', () => {
    expect(executionLinkTarget(link)).toBe('/execution/workflows/123e4567-e89b-42d3-a456-426614174000');
  });
});
