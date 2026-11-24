import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => (existsSync(path) ? readFileSync(path, 'utf8') : '');

const contractPath = 'data/ops/global-production-verification.json';
const verifierPath = 'scripts/verify-global-production.mjs';
const cloudflareWorkflowPath = '.github/workflows/cloudflare-deploy.yml';
const authorizedVerifierPath = 'supabase/functions/atlas-cloudflare-production-http-verify/index.ts';

const canonicalVoiceRoute = '/studio/voice';
const approvedAvatarAsset = '/assets/atlas-voice-avatar-approved.webp';

describe('ATLAS Voice production evidence', () => {
  it('requires the canonical Voice route and approved avatar asset in the shared fail-closed contract', () => {
    const contract = JSON.parse(read(contractPath)) as {
      public_routes?: string[];
      static_assets?: Array<{ path: string; content_type: string }>;
    };

    expect(contract.public_routes).toContain(canonicalVoiceRoute);
    expect(contract.static_assets).toContainEqual({
      path: approvedAvatarAsset,
      content_type: 'image/webp'
    });
  });

  it('makes the portable verifier fail closed on Voice asset regressions', () => {
    const verifier = read(verifierPath);

    expect(verifier).toContain('contract.static_assets');
    expect(verifier).toContain('probeStaticAsset');
    expect(verifier).toContain('content-type');
    expect(verifier).toContain('static_assets_verified');
    expect(verifier).toContain('production_commit_sha_verified');
  });

  it('keeps direct and authorized Cloudflare verification aligned to canonical Voice', () => {
    const workflow = read(cloudflareWorkflowPath);
    const authorizedVerifier = read(authorizedVerifierPath);

    expect(workflow).toContain(`probe_route "ATLAS Voice" "${canonicalVoiceRoute}" "voice_route_reachable"`);
    expect(workflow).toContain(`probe_asset "ATLAS Voice approved avatar" "${approvedAvatarAsset}" "image/webp" "voice_avatar_asset_verified"`);
    expect(authorizedVerifier).toContain(`'${canonicalVoiceRoute}'`);
    expect(authorizedVerifier).toContain(`'${approvedAvatarAsset}'`);
    expect(authorizedVerifier).toContain('voice_route_reachable');
    expect(authorizedVerifier).toContain('voice_avatar_asset_verified');
  });
});
