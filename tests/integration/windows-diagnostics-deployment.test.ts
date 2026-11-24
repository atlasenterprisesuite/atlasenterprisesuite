import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const agent = readFileSync('tools/local-agent/atlas-local-agent.mjs', 'utf8');
const installer = readFileSync('tools/local-agent/install-windows.ps1', 'utf8');
describe('Windows diagnostics deployment guard', () => {
  it('ships diagnostic module alongside the existing agent', () => {
    expect(installer).toContain('lib\\windows-diagnostics.mjs');
    expect(agent).toContain("import { collectWindowsDiagnosticSnapshot } from './lib/windows-diagnostics.mjs'");
  });
  it('requires explicit opt-in and Windows platform for local diagnostics', () => {
    expect(agent).toContain("process.platform === 'win32' && process.env.ATLAS_WINDOWS_DIAGNOSTICS_LOCAL === 'true'");
  });
  it('does not add remote desktop or diagnostics network operations', () => {
    expect(agent).toContain('const snapshot = collectWindowsDiagnosticSnapshot()');
    expect(agent).toContain('JSON.stringify(snapshot)');
    expect(installer).not.toContain('ATLAS_WINDOWS_DIAGNOSTICS_LOCAL =');
  });
});
