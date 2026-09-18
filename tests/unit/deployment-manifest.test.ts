import { describe, expect, it } from 'vitest';
import { createManifest, resolveCommitSha } from '../../scripts/write-deployment-manifest.mjs';

describe('ATLAS deployment manifest', () => {
  it('prefers GitHub SHA, then Cloudflare SHA, then local git SHA', () => {
    expect(resolveCommitSha({ GITHUB_SHA: 'github-sha', CF_PAGES_COMMIT_SHA: 'cf-sha' }, () => 'git-sha')).toBe('github-sha');
    expect(resolveCommitSha({ CF_PAGES_COMMIT_SHA: 'cf-sha' }, () => 'git-sha')).toBe('cf-sha');
    expect(resolveCommitSha({}, () => 'git-sha\n')).toBe('git-sha');
  });

  it('creates a public attestation with no secret material', () => {
    expect(createManifest('abc123', '12345')).toEqual({
      service: 'atlas-enterprise-suite-web',
      commit_sha: 'abc123',
      source: 'github-main',
      target: 'cloudflare-workers-static-assets',
      run_id: '12345',
    });
  });
});
