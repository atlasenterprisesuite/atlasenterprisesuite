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
    expect(pilotSource).toContain("domain !== 'atlasenterprisesuite.com'");
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
});
