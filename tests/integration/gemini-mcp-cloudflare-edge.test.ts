import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const worker = readFileSync('worker/index.ts', 'utf8');

describe('Gemini MCP Cloudflare edge contract', () => {
  it('publishes a governed MCP route from the existing ATLAS Worker', () => {
    expect(worker).toContain("url.pathname === '/mcp'");
    expect(worker).toContain('handleGeminiMcp');
    expect(worker).toContain("MCP_MODERN_PROTOCOL = '2026-07-28'");
    expect(worker).toContain("MCP_LEGACY_PROTOCOL = '2025-11-25'");
    expect(worker).toContain("method === 'server/discover'");
    expect(worker).toContain("method === 'initialize'");
    expect(worker).toContain("method === 'tools/list'");
    expect(worker).toContain("method === 'tools/call'");
  });

  it('requires bearer authentication without committing the live credential', () => {
    expect(worker).toContain('GEMINI_MCP_TOKEN_SHA256');
    expect(worker).toContain("authorization.toLowerCase().startsWith('bearer ')");
    expect(worker).toContain("www-authenticate");
    expect(worker).not.toContain('atlas_gemini_mcp_');
  });

  it('limits the first Gemini surface to read-only production verification tools', () => {
    expect(worker).toContain("name: 'atlas.production.status'");
    expect(worker).toContain("name: 'atlas.production.routes'");
    expect(worker).toContain("name: 'atlas.control_plane.readiness'");
    expect(worker).toContain('readOnlyHint: true');
    expect(worker).not.toContain("name: 'atlas.deploy.request'");
    expect(worker).not.toContain("name: 'atlas.code.propose'");
  });

  it('uses fixed production targets instead of caller-controlled outbound URLs', () => {
    expect(worker).toContain('MCP_CONTROL_PLANE_READINESS');
    expect(worker).toContain("const paths = ['/', '/identity', '/finance', '/health', '/work', '/execution/manager/readiness']");
    expect(worker).not.toContain('message?.params?.url');
  });

  it('does not claim Gemini is connected merely because the endpoint is deployed', () => {
    expect(worker).toContain('ATLAS Gemini MCP');
    expect(worker).toContain('least-privilege, read-only production verification tools');
    expect(worker).not.toContain('gemini_connected: true');
    expect(worker).not.toContain('provider_verified: true');
  });
});
