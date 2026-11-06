import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { assertValidTransformPng } from './png-integrity.mjs';

const manifestPath = join(process.cwd(), 'docs/creator/ATLAS_TRANSFORM_ENGINE_ASSET_MANIFEST.json');
const rejectedSinglePhotoSha256 = 'ea8008405be4f448c4a52c472716ffe6b87837820eff1f6a5e46821f2f7c6f32';

function fail(message) {
  console.error(`ATLAS_TRANSFORM_ASSET_P0: ${message}`);
  process.exitCode = 1;
}

if (!existsSync(manifestPath)) {
  fail('visual asset manifest is missing');
} else {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const { assetPath, expectedSha256, reviewedFrames } = manifest;
  if (assetPath !== 'apps/web/public/atlas/transform/frames.png') {
    fail('asset path is not canonical');
  } else if (!existsSync(assetPath)) {
    fail('no committed binary PNG at canonical path');
  } else {
    const buffer = readFileSync(assetPath);
    const hash = createHash('sha256').update(buffer).digest('hex');
    try { assertValidTransformPng(buffer); }
    catch (error) { fail(error instanceof Error ? error.message : 'PNG decode failed'); }
    if (hash === rejectedSinglePhotoSha256) fail('F5 source image contains one photograph, not nine independent frames');
    if (typeof expectedSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(expectedSha256) || hash !== expectedSha256) {
      fail('binary SHA-256 has not been certified for this exact image');
    }
  }
  if (!Array.isArray(reviewedFrames) || reviewedFrames.length !== 9
    || reviewedFrames.some((s, i) => s?.frame !== i + 1 || typeof s?.visualStage !== 'string' || !s.visualStage.trim())) {
    fail('nine manually verified transformation stages are not documented');
  }
  // Independent approval is checked live via GitHub API on the exact head.
  // Never persist the review URL in this same commit (circular dependency).
}
if (process.exitCode !== 1) console.log('ATLAS_TRANSFORM_ASSET_GATE: PASS');
