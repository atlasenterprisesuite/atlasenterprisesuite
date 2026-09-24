import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { verifyPublicTxt } from '../../supabase/functions/atlas-execution/dns-public';

const edgeSource = readFileSync('supabase/functions/atlas-execution/index.ts', 'utf8');
const pilotSource = readFileSync('supabase/functions/atlas-execution/openai-domain.ts', 'utf8');

describe('OpenAI domain pilot Edge contract', () => {
  it('registers typed template creation and rejects caller-defined steps', () => {
    expect(edgeSource).toContain("'create_work_template'");
    expect(edgeSource).toContain("requireExecutionPermission(context, 'execution.write')");
    expect(pilotSource).toContain("'manager.openai_domain_verification'");
    expect(pilotSource).toContain("const OPENAI_DOMAIN = 'atlasenterprisesuite.com'");
    expect(pilotSource).toContain('domain !== OPENAI_DOMAIN');
    expect(pilotSource).not.toContain('body.steps');
    expect(pilotSource).not.toContain('openai-domain-verification=');
  });

  it('builds ordinary execution workflow task and step rows', () => {
    expect(pilotSource).toContain("from('execution_workflows').insert");
    expect(pilotSource).toContain("from('execution_tasks').insert");
    expect(pilotSource).toContain("from('execution_steps').insert");
    expect(pilotSource).toContain('current_step_id');
    expect(pilotSource).toContain('current_task_id');
  });

  it('verifies public TXT using an injected DNS-over-HTTPS fetch', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      Answer: [{ type: 16, data: '"openai-domain-verification=abc"' }]
    }), { status: 200, headers: { 'content-type': 'application/dns-json' } }));

    const result = await verifyPublicTxt({ hostname: 'atlasenterprisesuite.com', expectedValue: 'openai-domain-verification=abc', fetchImpl: fetchImpl as any, attempts: 1, delayMs: 0 });
    expect(result.verified).toBe(true);
    expect(result.attemptsUsed).toBe(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('returns a propagation timeout as verified false', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ Answer: [] }), { status: 200 }));
    await expect(verifyPublicTxt({ hostname: 'atlasenterprisesuite.com', expectedValue: 'x', fetchImpl: fetchImpl as any, attempts: 1, delayMs: 0 }))
      .resolves.toMatchObject({ verified: false, attemptsUsed: 1 });
  });

  it('binds sensitive DNS mutation to the exact approved action payload', () => {
    expect(edgeSource).toContain("'execute_work_step'");
    expect(edgeSource).toContain("'resume_work_step'");
    expect(pilotSource).toContain('digestApprovalPayload');
    expect(pilotSource).toContain('approval_binding_mismatch');
    expect(pilotSource).toContain("action_type: 'create_dns_txt'");
    expect(pilotSource).toContain("status: 'awaiting_approval'");
  });

  it('routes DNS mutation only through a real API port or constrained browser job', () => {
    expect(pilotSource).toContain('DnsMutationPort');
    expect(pilotSource).toContain('dns_execution_capability_missing');
    expect(pilotSource).toContain('enqueueWorkRuntimeJob');
    expect(pilotSource).toContain("allowedActions: ['create_dns_txt']");
  });

  it('reports OpenAI authorization and browser runtime blockers separately', () => {
    expect(pilotSource).toContain('openai_authorized_session_missing');
    expect(pilotSource).toContain('openai_browser_runtime_missing');
    expect(pilotSource).toContain('openai_browser_execution_unavailable');
    expect(pilotSource).not.toContain('openai_browser_session_or_runtime_missing');
  });

  it('reconciles provider/public DNS state before mutation retry', () => {
    expect(pilotSource).toContain('resumeOpenAiDomainStep');
    expect(pilotSource).toContain('readTxt');
    expect(pilotSource).toContain('verifyPublicTxt');
    expect(pilotSource).toContain('dns_record_already_present');
  });
});
