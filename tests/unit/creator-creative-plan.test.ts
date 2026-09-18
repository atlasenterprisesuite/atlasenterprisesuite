import { describe, expect, it } from 'vitest';
import { buildCreativePlan } from '../../packages/creator/creative_plan';
import { compileSpecializedPrompt } from '../../packages/creator/prompt_engine';

const engines = [
  {
    engineId: 'prompt-export',
    displayName: 'Prompt Export',
    executionClass: 'prompt-export-only' as const,
    connectionState: 'ready' as const,
    ready: true,
    mediaKinds: ['image','video','music','voice','sfx','graphic','template'] as const,
    capabilityNotes: ['planning-only'],
    lastVerifiedAt: null
  }
];

describe('ATLAS CreativePlan', () => {
  it('normalizes all seven media kinds and preserves the source brief', () => {
    const plan = buildCreativePlan({
      title: 'Launch campaign',
      brief: '  Launch ATLAS for finance teams with a precise futuristic campaign.  ',
      mediaKinds: ['image','video','music','voice','sfx','graphic','template'],
      destinations: ['Instagram', 'Web'],
      audience: 'Finance leaders',
      aspectRatio: '16:9',
      language: 'English',
      accessibility: { captions: true, transcript: true, altText: true, audioDescription: false },
      negativeConstraints: ['No fake metrics']
    }, engines, {
      id: 'plan-1',
      organizationId: 'org-1',
      createdByUserId: 'user-1',
      now: '2026-09-18T17:00:00.000Z'
    });

    expect(plan.sourceBrief).toBe('  Launch ATLAS for finance teams with a precise futuristic campaign.  ');
    expect(plan.normalizedObjective).toBe('Launch ATLAS for finance teams with a precise futuristic campaign.');
    expect(plan.mediaKinds).toEqual(['image','video','music','voice','sfx','graphic','template']);
    expect(plan.deliverables).toHaveLength(7);
    expect(plan.promptSet).toHaveLength(7);
    expect(plan.accessibilityPlan.captions).toBe(true);
    expect(plan.negativeConstraints).toEqual(['No fake metrics']);
  });

  it('plans sfx, graphics and templates with specialized outputs', () => {
    const plan = buildCreativePlan({
      title: 'Creator pack',
      brief: 'Create a polished launch asset family for ATLAS.',
      mediaKinds: ['sfx','graphic','template'],
      destinations: ['Web'],
      audience: 'Customers',
      aspectRatio: '1:1',
      language: 'English',
      accessibility: { captions: false, transcript: false, altText: true, audioDescription: false },
      negativeConstraints: []
    }, engines, {
      id: 'plan-2', organizationId: 'org-1', createdByUserId: 'user-1', now: '2026-09-18T17:00:00.000Z'
    });

    expect(plan.deliverables.map(value => value.mediaKind)).toEqual(['sfx','graphic','template']);
    expect(compileSpecializedPrompt(plan, 'sfx').prompt).toContain('SOUND EFFECT');
    expect(compileSpecializedPrompt(plan, 'graphic').prompt).toContain('GRAPHIC');
    expect(compileSpecializedPrompt(plan, 'template').prompt).toContain('TEMPLATE');
  });

  it('selects the first ready zero-cost-first compatible engine per media kind', () => {
    const plan = buildCreativePlan({
      title: 'Image',
      brief: 'Create an ATLAS campaign image for finance leaders.',
      mediaKinds: ['image'],
      destinations: ['Web'],
      audience: 'Finance leaders',
      aspectRatio: '16:9',
      language: 'English',
      accessibility: { captions: false, transcript: false, altText: true, audioDescription: false },
      negativeConstraints: []
    }, [
      ...engines,
      {
        engineId: 'browser:image',
        displayName: 'Browser Image',
        executionClass: 'browser-local' as const,
        connectionState: 'ready' as const,
        ready: true,
        mediaKinds: ['image'] as const,
        capabilityNotes: [],
        lastVerifiedAt: null
      }
    ], {
      id: 'plan-3', organizationId: 'org-1', createdByUserId: 'user-1', now: '2026-09-18T17:00:00.000Z'
    });

    expect(plan.enginePreference.image).toBe('browser:image');
  });
});
