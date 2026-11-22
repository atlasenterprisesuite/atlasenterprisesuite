import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');

test('OpenCode pilot preserves ATLAS canonical orchestrator', () => {
  const instructions = read('AGENTS.md');
  assert.match(instructions, /Do not create a parallel execution architecture/i);
  assert.match(instructions, /atlasenterprisesuite\/atlasenterprisesuite/);
  assert.ok(existsSync(new URL('../../apps/atlas-orchestrator/src/runtime/auth.ts', import.meta.url)));
  assert.ok(existsSync(new URL('../../packages/agent-registry/src/defaultAgents.ts', import.meta.url)));
});

test('OpenCode configuration keeps existing Cloudflare MCP providers', () => {
  const config = JSON.parse(read('.opencode.jsonc'));
  for (const provider of ['cloudflare', 'cloudflare-docs', 'cloudflare-bindings', 'cloudflare-builds', 'cloudflare-observability']) {
    assert.equal(config.mcp?.[provider]?.type, 'remote', provider);
    assert.equal(config.mcp?.[provider]?.enabled, true, provider);
  }
});

test('ATLAS agent registry already has implementation, review, QA and release roles', () => {
  const registry = read('packages/agent-registry/src/defaultAgents.ts');
  for (const role of ['atlas-architect', 'atlas-planner', 'atlas-openai-engineer', 'atlas-reviewer', 'atlas-qa', 'atlas-release-governor']) {
    assert.ok(registry.includes("id: '" + role + "'"), role);
  }
  assert.match(registry, /allowedEnvironments:\s*\['development', 'test'\]/);
});

test('Existing persistent runner has actual quality gates and no implicit deployment', () => {
  const workflow = read('.github/workflows/atlas-777-persistent-runner.yml');
  for (const gate of ['npm ci', 'npm run test:unit', 'npm run test:integration', 'npm run typecheck', 'npm run build']) {
    assert.ok(workflow.includes(gate), gate);
  }
  assert.match(workflow, /contents:\s*read/);
  assert.doesNotMatch(workflow, /wrangler deploy|npm run deploy|cloudflare deploy/i);
});

test('OpenCode compatibility pilot fails closed without runtime proof', () => {
  const plan = read('docs/integrations/OPENCODE_TEAM_777_PILOT.md');
  assert.match(plan, /NO-GO/i);
  assert.match(plan, /runtime.*unverified/i);
  assert.match(plan, /no production deploy/i);
});
