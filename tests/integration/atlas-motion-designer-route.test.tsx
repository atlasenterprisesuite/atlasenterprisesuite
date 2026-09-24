import { describe, expect, it } from 'vitest';
import { DIRECTOR_STEPS } from '../../apps/web/src/modules/creator/director/DirectorWorkspace';

describe('ATLAS Motion Designer integration',()=>{
  it('is a Director step rather than a parallel top-level app',()=>{
    expect(DIRECTOR_STEPS).toContain('Motion Designer');
    expect(DIRECTOR_STEPS.indexOf('Motion Designer')).toBeGreaterThan(DIRECTOR_STEPS.indexOf('Camera & Motion'));
    expect(DIRECTOR_STEPS.indexOf('Motion Designer')).toBeLessThan(DIRECTOR_STEPS.indexOf('Provider & Cost'));
  });
});
