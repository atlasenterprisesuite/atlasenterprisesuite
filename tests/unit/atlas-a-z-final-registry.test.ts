import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const registry=readFileSync('apps/web/src/modules/registry.ts','utf8');

describe('ATLAS A-Z final registry closure',()=>{
  it('contains no partial module readiness',()=>{
    expect(registry).not.toContain("readiness: 'partial'");
  });

  it('allows only truthful final readiness states',()=>{
    const states=[...registry.matchAll(/readiness: '([^']+)'/g)].map(match=>match[1]);
    expect(states.length).toBeGreaterThan(20);
    expect(new Set(states)).toEqual(new Set(['implemented','external-gated']));
  });
});
