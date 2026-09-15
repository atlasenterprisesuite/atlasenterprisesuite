import { describe, expect, it } from 'vitest';
import {
  buildStructuredDraft,
  createContentWorkspaceState,
  createDirectorHandoff,
  createPublisherHandoff,
  generateAudienceInsights,
  generateContentIdeas,
  generateHookVariants,
  repurposeDraft,
  reviewDraft,
  type CreatorProfile
} from '../../packages/creator/content_intelligence';

const profile: CreatorProfile = {
  niche: 'small business finance',
  objective: 'teach practical financial operations',
  tone: 'clear, direct and encouraging',
  platforms: ['instagram', 'tiktok', 'youtube', 'linkedin', 'x'],
  audience: 'busy small-business owners',
  language: 'English'
};

describe('ATLAS Content Intelligence domain', () => {
  it('starts with a clean deterministic workspace', () => {
    const workspace = createContentWorkspaceState();
    expect(workspace.version).toBe(0);
    expect(workspace.profile.platforms).toEqual([]);
    expect(workspace.ideas).toEqual([]);
    expect(workspace.review).toBeNull();
  });

  it('derives useful audience intelligence from supplied context', () => {
    const audience = generateAudienceInsights(profile, 'Busy owners need easier financial operations and fear expensive mistakes.');
    expect(audience.problems.length).toBeGreaterThanOrEqual(3);
    expect(audience.questions.length).toBeGreaterThanOrEqual(3);
    expect(audience.motivations.length).toBeGreaterThanOrEqual(3);
    expect(audience.summary).toContain('busy small-business owners');
  });

  it('generates ranked ideas and five distinct hook styles', () => {
    const audience = generateAudienceInsights(profile, 'Owners need easier finance operations.');
    const ideas = generateContentIdeas(profile, audience);
    expect(ideas.length).toBeGreaterThanOrEqual(6);
    expect(ideas[0].score).toBeGreaterThanOrEqual(ideas[1].score);

    const hooks = generateHookVariants(ideas[0], profile);
    expect(hooks).toHaveLength(5);
    expect(new Set(hooks.map(item => item.style)).size).toBe(5);
  });

  it('builds, repurposes and reviews a structured draft without external providers', () => {
    const audience = generateAudienceInsights(profile, 'Owners want clarity and fewer mistakes.');
    const idea = generateContentIdeas(profile, audience)[0];
    const hook = generateHookVariants(idea, profile)[0];
    const draft = buildStructuredDraft(idea, hook, profile);

    expect(draft.introduction).toContain(hook.text);
    expect(draft.bodyPoints.length).toBeGreaterThanOrEqual(3);
    expect(draft.cta.length).toBeGreaterThan(0);

    const variants = repurposeDraft(draft);
    expect(variants.map(item => item.platform)).toEqual(['instagram', 'tiktok', 'youtube', 'linkedin', 'x']);
    expect(variants.every(item => item.content.length > 20)).toBe(true);

    const review = reviewDraft(draft);
    expect(review.overallScore).toBeGreaterThanOrEqual(0);
    expect(review.overallScore).toBeLessThanOrEqual(100);
    expect(review.criteria).toHaveProperty('clarity');
    expect(review.criteria).toHaveProperty('structure');
    expect(review.criteria).toHaveProperty('hookStrength');
    expect(review.criteria).toHaveProperty('ctaPresence');

    const director = createDirectorHandoff(draft);
    expect(director.atlasContentHandoff.brief).toContain(draft.title);
    expect(director.atlasContentHandoff.narration.length).toBeGreaterThan(20);

    const publisher = createPublisherHandoff(variants[0]);
    expect(publisher.atlasContentHandoff.caption).toBe(variants[0].content);
    expect(publisher.atlasContentHandoff.platform).toBe('instagram');
  });
});
