import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const world = readFileSync(`${process.cwd()}/apps/web/src/modules/frontier/FrontierWorld3D.tsx`, 'utf8');
const route = readFileSync(`${process.cwd()}/apps/web/src/modules/frontier/FrontierRoutes.tsx`, 'utf8');
const api = readFileSync(`${process.cwd()}/apps/web/src/modules/frontier/api.ts`, 'utf8');

describe('ATLAS FRONTIER WebGL world contract', () => {
  it('uses a real WebGL2 rendering context with a fail-safe fallback', () => {
    expect(world).toContain("getContext('webgl2'");
    expect(world).toContain("setEngineStatus('fallback')");
    expect(world).toContain('requestAnimationFrame');
  });

  it('supports keyboard, touch movement and hold-to-extract interaction', () => {
    expect(world).toContain("['w','a','s','d'");
    expect(world).toContain('frontier-mobile-controls');
    expect(world).toContain('beginExtraction');
    expect(world).toContain('900');
  });

  it('keeps build and resource mutations behind the existing governed action callback', () => {
    expect(world).toContain("await onAction('build_habitat')");
    expect(world).toContain('await onAction(target.action)');
    expect(world).not.toContain('/rest/v1/');
    expect(api).toContain("'/rest/v1/rpc/frontier_apply_action'");
  });

  it('replaces the CSS-only world with the interactive renderer', () => {
    expect(route).toContain('<FrontierWorld3D');
    expect(route).not.toContain('<div className="frontier-world"');
    expect(route).toContain("action.id === 'build_habitat'");
  });
});
