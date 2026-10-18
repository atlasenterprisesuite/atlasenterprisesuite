import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  'supabase/migrations/20261004002900_orchestrator_private_security_boundary.sql',
  'utf8',
);

const operations = [
  'create_task',
  'get_task',
  'save_task',
  'append_event',
  'list_events',
];

describe('ATLAS orchestrator private security boundary', () => {
  it('keeps privileged implementations outside the exposed public schema', () => {
    for (const operation of operations) {
      expect(sql).toContain(
        `private.atlas_orchestrator_${operation}_internal`,
      );
    }

    expect(sql.match(/security definer/g)?.length).toBe(5);
    expect(sql.match(/security invoker/g)?.length).toBe(5);
    expect(sql).toContain("set search_path = ''");
    expect(sql).toContain('atlas_orchestrator_runtime_unauthorized');
  });

  it('leaves only invoker wrappers on the public RPC surface', () => {
    for (const operation of operations) {
      const publicFunction = new RegExp(
        `create or replace function public\\.atlas_orchestrator_${operation}[\\s\\S]*?security invoker`,
      );
      expect(sql).toMatch(publicFunction);
    }

    expect(sql).not.toMatch(
      /create or replace function public\.atlas_orchestrator_[\s\S]*?security definer/,
    );
  });

  it('denies generic public and authenticated execution while preserving the token-gated runtime path', () => {
    expect(sql).toContain(
      'revoke all on function public.atlas_orchestrator_get_task(text,text,text) from public, authenticated;',
    );
    expect(sql).toContain(
      'grant execute on function public.atlas_orchestrator_get_task(text,text,text) to anon, service_role;',
    );
    expect(sql).toContain('grant usage on schema private to anon, service_role;');
  });

  it('preserves tenant, organization and task predicates in private implementations', () => {
    expect(sql.match(/tenant_id = p_tenant_id/g)?.length).toBeGreaterThanOrEqual(3);
    expect(sql.match(/organization_id = p_organization_id/g)?.length).toBeGreaterThanOrEqual(3);
    expect(sql.match(/task_id = p_task_id/g)?.length).toBeGreaterThanOrEqual(3);
  });
});
