import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  safePersonaCiUrl, summarizePersonaChecks
} from '../../packages/compliance/persona-monitor';

const code = readFileSync('apps/web/src/modules/security/PersonaCiMonitorPage.tsx', 'utf8');
const app = readFileSync('apps/web/src/App.tsx', 'utf8');
const shell = readFileSync('apps/web/src/components/AtlasShell.tsx', 'utf8');
const identity = readFileSync('apps/web/src/identity/IdentityPage.tsx', 'utf8');

describe('ATLAS Persona CI live monitor — evidence truth', () => {
  it('counts real report statuses without turning missing or skipped into passed', () => {
    const data = summarizePersonaChecks({ check_runs: [
      {id:1,name:'persona-contract',status:'completed',conclusion:'success'},
      {id:2,name:'check build',status:'in_progress',conclusion:null},
      {id:3,name:'preview',status:'completed',conclusion:'skipped'},
      {id:4,name:'scanner',status:'completed',conclusion:'neutral'}
    ] });
    expect(data).toMatchObject({total:4,passed:1,running:1,skipped:1,inconclusive:1,failed:0,result:'running'});
  });

  it('fails closed on cancelled, failed and timed-out checks', () => {
    for (const conclusion of ['failure','cancelled','timed_out','action_required']) {
      const output=summarizePersonaChecks({check_runs:[{id:1,name:'release',status:'completed',conclusion}]});
      expect(output.result).toBe('blocked');
      expect(output.failed).toBe(1);
    }
  });

  it('does not invent success for empty, inaccessible or malformed API responses', () => {
    for (const input of [null,undefined,{},[],{check_runs:[]},{check_runs:null}]) {
      expect(summarizePersonaChecks(input)).toMatchObject({
        total:0,passed:0,result:'no_evidence'
      });
    }
  });

  it('treats unknown results as inconclusive rather than passing', () => {
    expect(summarizePersonaChecks({check_runs:[
      {id:1,name:'new conclusion',status:'completed',conclusion:'unknown'}
    ]}).result).toBe('inconclusive');
  });

  it('only links to canonical GitHub repo paths (no injection/external destinations)', () => {
    const safe='https://github.com/atlasenterprisesuite/atlasenterprisesuite/actions/runs/123';
    expect(safePersonaCiUrl(safe)).toBe(safe);
    for (const url of ['javascript:alert(1)','https://evil.example',
      'https://github.com.evil.example/atlasenterprisesuite/atlasenterprisesuite/',
      '/relative/link',null]) {
      expect(safePersonaCiUrl(url)).toBe('https://github.com/atlasenterprisesuite/atlasenterprisesuite/pull/1016');
    }
  });

  it('loads the current PR SHA and checks via read-only GitHub API, never fake state', () => {
    expect(code).toContain("API + '/pulls/' + PR_NUMBER");
    expect(code).toContain("'/commits/' + encodeURIComponent(head.sha) + '/check-runs?per_page=100'");
    expect(code).toContain("!Array.isArray(checks.check_runs)");
    expect(code).toContain("setError(true)");
    expect(code).toContain("cache: 'no-store'");
    expect(code).not.toContain('Authorization:');
    expect(code).not.toContain('NEXT_PUBLIC_GITHUB_TOKEN');
    expect(code).not.toContain('setInterval(() => setSnapshot(');
  });

  it('makes the fixed monitor reachable in the authenticated shell and after login', () => {
    expect(app).toContain('<RequireAtlasIdentity><PersonaCiMonitorPage /></RequireAtlasIdentity>');
    expect(app).toContain('path="/security/persona-monitor"');
    expect(shell).toContain('to="/security/persona-monitor"');
    expect(identity).toContain("'/security/persona-monitor'");
  });

  it('provides manual refresh, bounded interval and accessibility status', () => {
    expect(code).toContain('const REFRESH_MS = 300000');
    expect(code).toContain("document.visibilityState === 'visible'");
    expect(code).toContain('aria-live="polite"');
    expect(code).toContain('aria-label={');
    expect(code).toContain('Actualizar ahora');
    expect(code).toContain('current?.abort();');
  });
});
