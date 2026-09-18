import { describe, expect, it } from 'vitest';
import {
  auditConversion,
  buildConstructionPlan,
  buildHeroPlan,
  buildLaunchPlan,
  buildMasterPlan,
  createWebLaunchBlueprintState
} from '../../packages/creator/web_launch';

const profile = {
  brand: 'ATLAS Enterprise Suite',
  audience: 'operations leaders',
  competitors: ['Verified reference A'],
  promise: 'run the business from one governed platform',
  proof: '47/47 readiness checks passed in the supplied evidence',
  primaryAction: 'Start with ATLAS',
  tone: 'futuristic and precise',
  language: 'English'
};

describe('ATLAS Web Launch domain', () => {
  it('builds the master plan from supplied context without inventing competitor research', () => {
    const plan = buildMasterPlan(profile);
    expect(plan.pageStructure).toContain('Hero');
    expect(plan.buildOrder.join(' ')).toContain('Verified reference A');
    expect(plan.buildOrder.join(' ')).toContain('supplied competitor references');
  });

  it('produces a hero with one primary action and A/B variants', () => {
    const hero = buildHeroPlan(profile);
    expect(hero.primaryCta).toBe('Start with ATLAS');
    expect(hero.variants).toHaveLength(3);
    expect(hero.supportVisual).toContain('Reuse approved Creator Library assets');
  });

  it('includes accessibility, performance and a fail-closed launch gate', () => {
    const construction = buildConstructionPlan();
    const launch = buildLaunchPlan();
    expect(construction.accessibility).toContain('Reduced-motion support');
    expect(construction.prelaunchChecklist).toContain('No 404/500 routes');
    expect(launch.stopCriteria.join(' ')).toContain('fail-closed');
    expect(launch.stopCriteria.join(' ')).toContain('critical ATLAS Network routes');
  });

  it('surfaces missing proof as a conversion risk', () => {
    const blueprint = createWebLaunchBlueprintState();
    blueprint.profile = { ...profile, proof: '' };
    blueprint.hero = buildHeroPlan(blueprint.profile);
    const audit = auditConversion(blueprint);
    expect(audit.frictionPoints.join(' ')).toContain('No verified proof');
    expect(audit.topChanges[0]).toContain('verified evidence');
  });
});
