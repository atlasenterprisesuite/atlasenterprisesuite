import { readFileSync, existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const projectMcp = JSON.parse(readFileSync('.github/mcp.json', 'utf8'));
const vscodeMcp = JSON.parse(readFileSync('.vscode/mcp.json', 'utf8'));

const expected = {
  cloudflare: 'https://mcp.cloudflare.com/mcp',
  'cloudflare-docs': 'https://docs.mcp.cloudflare.com/mcp',
  'cloudflare-bindings': 'https://bindings.mcp.cloudflare.com/mcp',
  'cloudflare-builds': 'https://builds.mcp.cloudflare.com/mcp',
  'cloudflare-observability': 'https://observability.mcp.cloudflare.com/mcp',
};

describe('Cloudflare Copilot agent setup', () => {
  it('registers the official Cloudflare MCP endpoints for Copilot CLI/project scope', () => {
    for (const [name, url] of Object.entries(expected)) {
      expect(projectMcp.mcpServers?.[name]?.url).toBe(url);
    }
  });

  it('registers the same remote MCP endpoints using the VS Code servers schema', () => {
    for (const [name, url] of Object.entries(expected)) {
      expect(vscodeMcp.servers?.[name]?.type).toBe('http');
      expect(vscodeMcp.servers?.[name]?.url).toBe(url);
    }
  });

  it('installs the Cloudflare skills used by the current ATLAS architecture', () => {
    for (const skill of [
      'agents-sdk',
      'cloudflare-one',
      'durable-objects',
      'web-perf',
      'workers-best-practices',
      'wrangler',
    ]) {
      expect(existsSync(`.github/skills/${skill}/SKILL.md`)).toBe(true);
    }
  });

  it('keeps OAuth credentials and provider secrets out of repository MCP config', () => {
    const combined = JSON.stringify({ projectMcp, vscodeMcp });
    expect(combined).not.toMatch(/token|secret|password|authorization/i);
  });
});
