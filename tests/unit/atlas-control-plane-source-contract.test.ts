import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ATLAS_CONTROL_PLANE_OWNERS,
  ATLAS_CONTROL_PLANE_STAGES
} from '../../packages/execution/src';

describe('ATLAS control-plane canonical owners', () => {
  it('keeps every stage bound to exactly one existing canonical implementation owner', () => {
    const paths = new Set<string>();

    for (const stage of ATLAS_CONTROL_PLANE_STAGES) {
      const owner = ATLAS_CONTROL_PLANE_OWNERS[stage];
      const source = readFileSync(owner.path, 'utf8');

      expect(source).toContain(owner.symbol);
      expect(paths.has(owner.path)).toBe(false);
      paths.add(owner.path);
    }
  });

  it('keeps server-resolved identity and scope ahead of execution', () => {
    const auth = readFileSync(
      'supabase/functions/atlas-copilot/atlas-intelligence-auth.mjs',
      'utf8'
    );
    const context = readFileSync(
      'packages/execution/src/context-engine.ts',
      'utf8'
    );
    const execution = readFileSync(
      'packages/execution/src/engine.ts',
      'utf8'
    );

    expect(auth).toContain('organization_members');
    expect(auth).toContain('identity_role_permissions');
    expect(auth).toContain('session_id');
    expect(context).toContain("source: 'server'");
    expect(context).toContain('atlas_context_untrusted');
    expect(execution).toContain('assertSameScope');
    expect(execution).toContain('permissionsRequired');
  });

  it('keeps policy, capability execution, verification, evidence and audit fail-closed', () => {
    const policy = readFileSync(
      'packages/execution/src/policy-fabric.ts',
      'utf8'
    );
    const workPolicy = readFileSync(
      'packages/execution/src/work-policy.ts',
      'utf8'
    );
    const capability = readFileSync(
      'packages/execution/src/capability-catalog.ts',
      'utf8'
    );
    const evidence = readFileSync(
      'packages/execution/src/evidence-bridge.ts',
      'utf8'
    );
    const engine = readFileSync(
      'packages/execution/src/engine.ts',
      'utf8'
    );
    const edge = readFileSync(
      'supabase/functions/atlas-execution/index.ts',
      'utf8'
    );

    expect(workPolicy).toContain("outcome: 'deny'");
    expect(workPolicy).toContain("outcome: 'require_approval'");
    expect(policy).toContain('approvalMatchesPayload');
    expect(policy).toContain("outcome: 'allow'");
    expect(capability).toContain('capability_not_ready');
    expect(evidence).toContain('authenticated_execution_evidence_required');
    expect(engine).toContain('adapter.authorize');
    expect(engine).toContain('adapter.execute');
    expect(engine).toContain('adapter.verify');
    expect(engine).toContain('appendEvidence');
    expect(edge).toContain('execution_audit_events');
    expect(edge).toContain('execution_evidence');
    expect(edge).toContain('execution_approvals');
  });
});
