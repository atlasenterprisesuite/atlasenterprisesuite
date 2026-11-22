import { describe, expect, it } from 'vitest';
import { ENTERPRISE_DEPARTMENTS, projectEnterpriseDepartments } from '../../apps/web/src/work/enterpriseDepartments';
import { ATLAS_MODULES } from '../../apps/web/src/modules/registry';
import type { WorkWorkflow } from '../../apps/web/src/work/types';

function workflow(id: string, ownerModule: string, status: WorkWorkflow['status']): WorkWorkflow {
  return { id, ownerModule, status } as WorkWorkflow;
}

describe('enterprise department workflow projection', () => {
  it('uses unique canonical owner modules and all ten departments', () => {
    expect(ENTERPRISE_DEPARTMENTS).toHaveLength(10);
    const ids = ENTERPRISE_DEPARTMENTS.flatMap(d => [...d.modules] as string[]);
    expect(new Set(ids).size).toBe(ids.length);
    const registered = new Set(['manager', ...ATLAS_MODULES.map(m => m.id)]);
    expect(ids.every(id => registered.has(id))).toBe(true);
    expect(ENTERPRISE_DEPARTMENTS.every(d => (d.modules as readonly string[]).includes(d.primary))).toBe(true);
  });
  it('counts only actual workflow statuses and preserves unmapped records', () => {
    const data = projectEnterpriseDepartments([
      workflow('a', 'accounting', 'awaiting_approval'),
      workflow('b', 'finance', 'completed'),
      workflow('c', 'accounting', 'now'),
      workflow('d', 'tax', 'failed'),
      workflow('e', 'tax', 'draft'),
      workflow('f', 'unknown', 'completed')
    ]);
    const finance = data.departments.find(d => d.department.id === 'finance');
    expect(finance).toMatchObject({ awaitingApproval: 1, completed: 1, inProgress: 1, blocked: 1 });
    expect(finance?.workflows).toHaveLength(5);
    expect(data.unassigned.map(w => w.id)).toEqual(['f']);
    expect(data.departments.find(d => d.department.id === 'health')?.completed).toBe(0);
  });
  it('does not invent activity for empty organizations', () => {
    const result = projectEnterpriseDepartments([]);
    expect(result.departments.every(d => d.workflows.length === 0 && d.completed === 0 && d.awaitingApproval === 0)).toBe(true);
    expect(result.unassigned).toEqual([]);
  });
});
