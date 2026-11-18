import { createGovernedPublisherHandoff } from '../../packages/creator/content_intelligence';
import { describe, expect, it } from 'vitest';
import {
  createGovernedYouTubeUploadIntent,
  evaluateCreatorPublishGate,
  type CreatorPublishRequest
} from '../../packages/creator/publishing_gate';

const HASH = 'a'.repeat(64);
const NOW = '2026-11-18T07:00:00.000Z';

function fixture(): CreatorPublishRequest {
  return {
    tenantId: 'atlas',
    channelId: 'channel-1',
    targetPlatform: 'youtube',
    jobKey: 'gta6-first-original-short',
    reviewedArtifactSha256: HASH,
    outputArtifactSha256: HASH,
    claimsReviewed: true,
    editorialApproval: true,
    syntheticMediaDisclosureReviewed: true,
    sources: [{ id: 'source-1', url: 'https://www.youtube.com/howyoutubeworks/', checkedAt: '2026-11-18T06:00:00Z', claim: 'General content policy reference', status: 'verified' }],
    assets: [{ id: 'visual-1', sha256: HASH, rights: 'original', approvedPlatforms: ['youtube'] }],
    credential: {
      tenantId: 'atlas',
      channelId: 'channel-1',
      platform: 'youtube',
      scopes: ['https://www.googleapis.com/auth/youtube.upload'],
      expiresAt: '2026-11-19T07:00:00Z',
      revoked: false
    },
    previousJobKeys: []
  };
}

describe('Creator publish gate — P0 fail closed', () => {
  it('only produces private upload intent when every review requirement is satisfied', () => {
    const request = fixture();
    expect(evaluateCreatorPublishGate(request, NOW)).toMatchObject({ allowed: true, errors: [], stage: 'eligible_for_private_upload' });
    expect(createGovernedYouTubeUploadIntent(request, NOW)).toEqual({
      privacyStatus: 'private', jobKey: request.jobKey, channelId: request.channelId, artifactSha256: HASH
    });
  });

  it.each([
    ['unlicensed asset', (r: CreatorPublishRequest) => { r.assets[0].rights = 'unknown'; }, 'asset_rights_not_proven'],
    ['licensed without evidence', (r: CreatorPublishRequest) => { r.assets[0].rights = 'licensed'; }, 'asset_rights_not_proven'],
    ['wrong platform rights', (r: CreatorPublishRequest) => { r.assets[0].approvedPlatforms = ['instagram']; }, 'asset_rights_not_proven'],
    ['expired license', (r: CreatorPublishRequest) => { r.assets[0].expiresAt = '2026-11-17T00:00:00Z'; }, 'asset_license_expired'],
    ['invalid media hash', (r: CreatorPublishRequest) => { r.assets[0].sha256 = 'bad'; }, 'invalid_asset_manifest'],
    ['missing source', (r: CreatorPublishRequest) => { r.sources = []; }, 'source_ledger_missing'],
    ['source has no URL', (r: CreatorPublishRequest) => { r.sources[0].url = ''; }, 'unverified_source'],
    ['source is unverified', (r: CreatorPublishRequest) => { r.sources[0].status = 'unverified'; }, 'unverified_source'],
    ['source date in the future', (r: CreatorPublishRequest) => { r.sources[0].checkedAt = '2026-12-01T00:00:00Z'; }, 'unverified_source'],
    ['missing editorial approval', (r: CreatorPublishRequest) => { r.editorialApproval = false; }, 'editorial_review_missing'],
    ['disclosure not reviewed', (r: CreatorPublishRequest) => { r.syntheticMediaDisclosureReviewed = false; }, 'synthetic_media_review_missing'],
    ['wrong tenant', (r: CreatorPublishRequest) => { r.credential!.tenantId = 'other'; }, 'channel_authorization_invalid'],
    ['wrong channel', (r: CreatorPublishRequest) => { r.credential!.channelId = 'other'; }, 'channel_authorization_invalid'],
    ['missing scope', (r: CreatorPublishRequest) => { r.credential!.scopes = []; }, 'channel_authorization_invalid'],
    ['revoked scope', (r: CreatorPublishRequest) => { r.credential!.revoked = true; }, 'channel_authorization_invalid'],
    ['expired token', (r: CreatorPublishRequest) => { r.credential!.expiresAt = '2026-11-17T07:00:00Z'; }, 'channel_authorization_invalid'],
    ['no credential', (r: CreatorPublishRequest) => { r.credential = null; }, 'channel_authorization_invalid'],
    ['SHA differs', (r: CreatorPublishRequest) => { r.outputArtifactSha256 = 'b'.repeat(64); }, 'artifact_sha_mismatch'],
    ['repeated job', (r: CreatorPublishRequest) => { r.previousJobKeys = [r.jobKey]; }, 'duplicate_or_missing_job_key']
  ])('blocks %s', (_scenario, mutate, expected) => {
    const request = fixture();
    mutate(request);
    const decision = evaluateCreatorPublishGate(request, NOW);
    expect(decision.allowed).toBe(false);
    expect(decision.errors).toContain(expected);
    expect(() => createGovernedYouTubeUploadIntent(request, NOW)).toThrow('creator_publish_blocked');
  });

  it('rejects invalid clock instead of accidentally treating auth as valid', () => {
    expect(evaluateCreatorPublishGate(fixture(), 'not-a-date')).toMatchObject({ allowed: false, errors: expect.arrayContaining(['invalid_clock']) });
  });
});


describe('Content Intelligence integration', () => {
  it('passes a verified private-upload intent to the existing publisher format', () => {
    const result = createGovernedPublisherHandoff(
      { id: 'youtube-short', platform: 'youtube', format: 'Short', content: 'Original GTA VI fact-check' },
      fixture(),
      NOW
    );
    expect(result.atlasContentHandoff).toMatchObject({
      platform: 'youtube',
      caption: 'Original GTA VI fact-check',
      uploadIntent: { privacyStatus: 'private', artifactSha256: HASH }
    });
  });

  it('cannot bypass authorization through a wrong tenant or mismatched platform', () => {
    const request = fixture();
    request.credential!.tenantId = 'foreign-tenant';
    expect(() => createGovernedPublisherHandoff(
      { id: '1', platform: 'youtube', format: 'Short', content: 'x' },
      request, NOW
    )).toThrow('creator_publish_blocked');
    expect(() => createGovernedPublisherHandoff(
      { id: '2', platform: 'instagram', format: 'Reel', content: 'x' },
      fixture(), NOW
    )).toThrow('creator_publish_blocked:unsupported_platform');
  });
});
