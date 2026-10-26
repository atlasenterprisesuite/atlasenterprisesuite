import { describe, expect, it } from 'vitest';
import { DEFAULT_FLOURISHING_MODE, FLOURISHING_DIMENSIONS, reflectionForMode } from '../../apps/web/src/modules/wellbeing/humanFlourishing';

describe('Human Flourishing 777 safety contract', () => {
  it('defaults to secular reflection and does not expose Christian text without opt-in', () => {
    expect(DEFAULT_FLOURISHING_MODE).toBe('secular');
    const defaultReflection = reflectionForMode(DEFAULT_FLOURISHING_MODE);
    expect(defaultReflection.title).toBe('Reflexión personal');
    expect(defaultReflection.body).not.toMatch(/Santiago|Dios|oraci[oó]n/i);
  });
  it('reveals explicitly selected Christian reflection with its source', () => {
    expect(reflectionForMode('christian').source).toMatch(/Santiago 1:5/);
  });
  it('provides seven distinct dimensions with actual internal routes and no personal records', () => {
    expect(FLOURISHING_DIMENSIONS).toHaveLength(7);
    expect(new Set(FLOURISHING_DIMENSIONS.map(d => d.id)).size).toBe(7);
    for (const d of FLOURISHING_DIMENSIONS) {
      expect(d.route).toMatch(/^\//);
      expect(Object.keys(d).sort()).toEqual(['action','description','id','route','title']);
    }
  });
  it('does not contain persistence, analytics or remote transfer in its model', async () => {
    const { readFileSync } = await import('node:fs');
    const source = ['apps/web/src/modules/wellbeing/humanFlourishing.ts','apps/web/src/modules/wellbeing/HumanFlourishingPage.tsx'].map(path => readFileSync(path, 'utf8')).join('\n');
    expect(source).not.toMatch(/\b(?:localStorage|sessionStorage|indexedDB|fetch|XMLHttpRequest|sendBeacon|supabase|axios)\s*(?:\.|\()/);
    expect(source).not.toMatch(/\b(?:useEffect|navigator\.sendBeacon)\b/);
  });
});
