import { describe, expect, it } from 'vitest';
import { defaultAgents, getAgent } from '../../packages/agent-registry/src';

describe('ATLAS agent registry', () => {
  it('gives implementers code/test/PR permissions but never release authority', () => {
    for (const id of ['atlas-openai-engineer', 'atlas-copilot-engineer']) {
      const agent = getAgent(id);
      expect(agent.permissions).toContain('ai.code.write');
      expect(agent.permissions).toContain('ai.test.execute');
      expect(agent.permissions).toContain('ai.pr.create');
      expect(agent.permissions).not.toContain('release.approve');
      expect(agent.permissions).not.toContain('release.deploy');
    }
  });

  it('keeps reviewers and Gemini client identity read-oriented by default', () => {
    expect(getAgent('atlas-reviewer').permissions).not.toContain('ai.code.write');
    expect(getAgent('atlas-gemini-analyst').providerId).toBe('gemini');
    expect(getAgent('atlas-gemini-analyst').permissions).toContain('ai.task.read');
    expect(getAgent('atlas-gemini-analyst').permissions).not.toContain('ai.code.write');
  });

  it('lets the release governor request but never approve or execute deployment', () => {
    const governor = getAgent('atlas-release-governor');
    expect(governor.permissions).toContain('ai.deploy.request');
    expect(governor.permissions).not.toContain('release.approve');
    expect(governor.permissions).not.toContain('release.deploy');
  });

  it('has stable unique ids', () => {
    expect(new Set(defaultAgents.map((agent) => agent.id)).size).toBe(defaultAgents.length);
  });
});
