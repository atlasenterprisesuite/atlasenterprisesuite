import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const registry=readFileSync('apps/web/src/modules/registry.ts','utf8');

function moduleReadiness(id: string) {
  const start = registry.indexOf(`id: '${id}'`);
  expect(start, `missing module ${id}`).toBeGreaterThanOrEqual(0);
  const next = registry.indexOf('\n  {', start + 1);
  const block = registry.slice(start, next === -1 ? registry.length : next);
  return block.match(/readiness: '([^']+)'/)?.[1] || '';
}

describe('ATLAS A-Z final registry closure',()=>{
  it('allows implemented, partial and external-gated as truthful implementation states',()=>{
    const states=[...registry.matchAll(/readiness: '([^']+)'/g)].map(match=>match[1]);
    expect(states.length).toBeGreaterThan(20);
    expect(new Set(states)).toEqual(new Set(['implemented','partial','external-gated']));
  });

  it('keeps incomplete Knowledge and Learning visible as partial instead of forcing a false implemented state',()=>{
    for (const id of ['cloud','knowledge','advisory','accounting','learning','aviation']) {
      expect(moduleReadiness(id)).toBe('partial');
    }
  });
});
