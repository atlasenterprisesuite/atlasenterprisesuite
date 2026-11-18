/**
 * ATLAS Creator production gate — fail closed by default.
 * Pure domain logic; no tokens, uploads, or side effects.
 */
export type CreatorSource = {
  id: string;
  url: string;
  checkedAt: string;
  claim: string;
  status: 'verified' | 'unverified' | 'disputed';
};

export type CreatorAsset = {
  id: string;
  sha256: string;
  rights: 'original' | 'licensed' | 'unknown';
  licenseEvidence?: string;
  approvedPlatforms: string[];
  expiresAt?: string;
};

export type CreatorPublishRequest = {
  tenantId: string;
  channelId: string;
  targetPlatform: 'youtube';
  jobKey: string;
  reviewedArtifactSha256: string;
  outputArtifactSha256: string;
  sources: CreatorSource[];
  assets: CreatorAsset[];
  claimsReviewed: boolean;
  editorialApproval: boolean;
  syntheticMediaDisclosureReviewed: boolean;
  credential: {
    tenantId: string;
    channelId: string;
    platform: 'youtube';
    scopes: string[];
    expiresAt: string;
    revoked: boolean;
  } | null;
  previousJobKeys: string[];
};

const sha256 = /^[a-f0-9]{64}$/i;

function validDate(value: string): number | null {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function validHttps(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname);
  } catch {
    return false;
  }
}

export type CreatorGateResult = {
  allowed: boolean;
  errors: string[];
  stage: 'blocked' | 'eligible_for_private_upload';
};

/** Requires trusted server-side currentTime and an authoritative account/approval context. */
export function evaluateCreatorPublishGate(
  request: CreatorPublishRequest,
  currentTime: string
): CreatorGateResult {
  const errors: string[] = [];
  const now = validDate(currentTime);
  if (now === null) errors.push('invalid_clock');
  if (!request.tenantId.trim() || !request.channelId.trim()) errors.push('missing_tenant_or_channel');
  if (!request.jobKey.trim() || request.previousJobKeys.includes(request.jobKey)) errors.push('duplicate_or_missing_job_key');
  if (!sha256.test(request.reviewedArtifactSha256) ||
      !sha256.test(request.outputArtifactSha256) ||
      request.reviewedArtifactSha256.toLowerCase() !== request.outputArtifactSha256.toLowerCase()) {
    errors.push('artifact_sha_mismatch');
  }

  if (!request.claimsReviewed || !request.editorialApproval) errors.push('editorial_review_missing');
  if (!request.syntheticMediaDisclosureReviewed) errors.push('synthetic_media_review_missing');
  if (request.sources.length === 0) errors.push('source_ledger_missing');
  const sourceIds = new Set<string>();
  for (const source of request.sources) {
    if (!source.id.trim() || sourceIds.has(source.id)) errors.push('invalid_source_id');
    sourceIds.add(source.id);
    const checkedAt = validDate(source.checkedAt);
    if (!validHttps(source.url) || !source.claim.trim() || source.status !== 'verified' ||
        checkedAt === null || (now !== null && checkedAt > now)) errors.push('unverified_source');
  }
  if (request.assets.length === 0) errors.push('asset_ledger_missing');
  const assetIds = new Set<string>();
  for (const asset of request.assets) {
    if (!asset.id.trim() || assetIds.has(asset.id) || !sha256.test(asset.sha256)) errors.push('invalid_asset_manifest');
    assetIds.add(asset.id);
    if (asset.rights === 'unknown' ||
        (asset.rights === 'licensed' && !validHttps(asset.licenseEvidence || '')) ||
        !asset.approvedPlatforms.includes(request.targetPlatform)) errors.push('asset_rights_not_proven');
    if (asset.expiresAt) {
      const expiry = validDate(asset.expiresAt);
      if (expiry === null || (now !== null && expiry <= now)) errors.push('asset_license_expired');
    }
  }

  const credential = request.credential;
  if (!credential || credential.revoked ||
      credential.tenantId !== request.tenantId ||
      credential.channelId !== request.channelId ||
      credential.platform !== request.targetPlatform ||
      !credential.scopes.includes('https://www.googleapis.com/auth/youtube.upload') ||
      validDate(credential.expiresAt) === null ||
      (now !== null && validDate(credential.expiresAt)! <= now)) {
    errors.push('channel_authorization_invalid');
  }
  const uniqueErrors = [...new Set(errors)];
  return {
    allowed: uniqueErrors.length === 0,
    errors: uniqueErrors,
    stage: uniqueErrors.length === 0 ? 'eligible_for_private_upload' : 'blocked'
  };
}

/**
 * This creates a proposal for an upload only. A separate secure server worker
 * must atomically reserve jobKey, verify OAuth and rights against trusted
 * records, create a PRIVATE video and audit the provider response.
 */
export function createGovernedYouTubeUploadIntent(
  request: CreatorPublishRequest,
  currentTime: string
): { privacyStatus: 'private'; jobKey: string; channelId: string; artifactSha256: string } {
  const decision = evaluateCreatorPublishGate(request, currentTime);
  if (!decision.allowed) throw new Error('creator_publish_blocked:' + decision.errors.join(','));
  return {
    privacyStatus: 'private',
    jobKey: request.jobKey,
    channelId: request.channelId,
    artifactSha256: request.outputArtifactSha256.toLowerCase()
  };
}
