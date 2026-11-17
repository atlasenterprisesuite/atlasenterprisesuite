import { describe, expect, it } from 'vitest';
import { assessGameLaunchHandoff, buildGameLaunchIdeaPack } from '../../packages/creator/game_launch';

describe('ATLAS game launch editorial planner (planning-only)', () => {
  it('produces exactly 10 first-48h and 20 evergreen original prompts without fabricated metrics', () => {
    const ideas = buildGameLaunchIdeaPack({ gameName: 'GTA 6', language: 'es' });
    expect(ideas).toHaveLength(30);
    expect(ideas.filter(item => item.window === 'launch-48h')).toHaveLength(10);
    expect(ideas.filter(item => item.window === 'evergreen')).toHaveLength(20);
    expect(ideas.every(item => item.title.length <= 60 && item.thumbnail.length <= 24)).toBe(true);
    expect(ideas.every(item => item.evidenceStatus === 'unverified' && item.performance === null)).toBe(true);
    expect(new Set(ideas.map(item => item.title)).size).toBe(30);
    expect(ideas.every(item => item.capturePlan.length > 5)).toBe(true);
  });

  it('is deterministic and supports an English planning pack', () => {
    expect(buildGameLaunchIdeaPack({ gameName: 'GTA 6', language: 'es' }))
      .toEqual(buildGameLaunchIdeaPack({ gameName: 'GTA 6', language: 'es' }));
    const english = buildGameLaunchIdeaPack({ gameName: 'GTA 6', language: 'en' });
    expect(english).toHaveLength(30);
    expect(english[0].title).not.toBe(buildGameLaunchIdeaPack({ gameName: 'GTA 6', language: 'es' })[0].title);
  });

  it('rejects invalid names rather than injecting content or overlong titles', () => {
    expect(() => buildGameLaunchIdeaPack({ gameName: '', language: 'es' })).toThrow('game_name_invalid');
    expect(() => buildGameLaunchIdeaPack({ gameName: 'A'.repeat(40), language: 'es' })).toThrow('game_name_invalid');
  });

  it('fails closed with unknown authorization, rights, factual claims and accessibility', () => {
    const result = assessGameLaunchHandoff({
      identityVerified: false,
      tenantVerified: false,
      publisherPermissionVerified: false,
      sourceChecked: false,
      originalFootage: false,
      commercialRightsVerified: false,
      claimsVerified: false,
      captionsReady: false,
      transcriptReady: false,
      humanApproved: false,
      evidenceDigest: null
    });
    expect(result.status).toBe('NO_GO');
    expect(result.executable).toBe(false);
    expect(result.blockers).toContain('tenant_unverified');
    expect(result.blockers).toContain('rights_unverified');
    expect(result.blockers).toContain('evidence_digest_missing');
  });

  it('never equates client-side evidence assertions with publishing authorization', () => {
    const allClaimed = assessGameLaunchHandoff({
      identityVerified: true,
      tenantVerified: true,
      publisherPermissionVerified: true,
      sourceChecked: true,
      originalFootage: true,
      commercialRightsVerified: true,
      claimsVerified: true,
      captionsReady: true,
      transcriptReady: true,
      humanApproved: true,
      evidenceDigest: 'a'.repeat(64)
    });
    expect(allClaimed.status).toBe('REVIEW_REQUIRED');
    expect(allClaimed.executable).toBe(false);
    expect(allClaimed.blockers).toEqual([]);
  });
});
