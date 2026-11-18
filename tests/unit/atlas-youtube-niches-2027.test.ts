import { describe, expect, it } from 'vitest';
import {
  YOUTUBE_NICHES_2027,
  YOUTUBE_NICHE_VIDEO_2027,
  assessYouTubeNicheEvidence,
  makeYouTubeNicheProfile,
  makeYouTubeNicheResearchSeed
} from '../../packages/creator/youtube_niches_2027';

describe('ATLAS 777 YouTube source-backed niches', () => {
  it('records the source and ten distinct transcript-derived topics without fabricated results', () => {
    expect(YOUTUBE_NICHE_VIDEO_2027.videoId).toBe('FG89iOZOG4I');
    expect(YOUTUBE_NICHE_VIDEO_2027.claimsVerified).toBe(false);
    expect(YOUTUBE_NICHES_2027).toHaveLength(10);
    expect(new Set(YOUTUBE_NICHES_2027.map(item => item.id)).size).toBe(10);
    expect(YOUTUBE_NICHES_2027.map(item => item.startSeconds)).toEqual(
      [...YOUTUBE_NICHES_2027.map(item => item.startSeconds)].sort((a, b) => a - b)
    );
    expect(YOUTUBE_NICHES_2027.every(item =>
      item.startSeconds >= 0 && item.startSeconds < 916 &&
      item.originalAngle.length > 25 && item.researchRequirement.length > 15
    )).toBe(true);
    expect(JSON.stringify(YOUTUBE_NICHES_2027)).not.toMatch(/guaranteedRevenue|guaranteedViews|estimatedRPM/i);
  });

  it('transforms a topic into an original, Spanish-first YouTube creator profile', () => {
    const niche = YOUTUBE_NICHES_2027[3];
    const profile = makeYouTubeNicheProfile(niche);
    const seed = makeYouTubeNicheResearchSeed(niche);

    expect(profile.platforms).toEqual(['youtube']);
    expect(profile.language).toBe('Español');
    expect(profile.niche).toContain(niche.title);
    expect(seed).toContain('FG89iOZOG4I');
    expect(seed).toContain(niche.originalAngle);
    expect(seed).toMatch(/sin verificar|no verificadas/i);
  });

  it('fails closed when any evidence, rights, originality or disclosure review is missing', () => {
    const allTrue = {
      credibleSourcesChecked: true,
      rightsChecked: true,
      originalContributionChecked: true,
      syntheticMediaDisclosureReviewed: true,
      humanEditorialReview: true
    };
    expect(assessYouTubeNicheEvidence({...allTrue, rightsChecked: false}).status).toBe('NO_GO');
    expect(assessYouTubeNicheEvidence({...allTrue, credibleSourcesChecked: false}).blockers.length).toBeGreaterThan(0);
    expect(assessYouTubeNicheEvidence({...allTrue, humanEditorialReview: false}).status).toBe('NO_GO');
    expect(assessYouTubeNicheEvidence(allTrue).status).toBe('REVIEW_REQUIRED');
    expect(assessYouTubeNicheEvidence(allTrue).mayPublish).toBe(false);
  });
});
