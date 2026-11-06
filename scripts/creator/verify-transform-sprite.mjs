import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

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
  const { assetPath, expectedSha256, reviewedFrames, independentReview } = manifest;
  if (assetPath !== 'apps/web/public/atlas/transform/frames.png') {
    fail('asset path is not canonical');
  } else if (!existsSync(assetPath)) {
    fail('no committed binary PNG at canonical path');
  } else {
    const buffer = readFileSync(assetPath);
    const hash = createHash('sha256').update(buffer).digest('hex');
    const sig = '89504e470d0a1a0a';
    if (buffer.length < 24 || buffer.subarray(0, 8).toString('hex') !== sig) fail('not a valid PNG signature');
    else {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      if (width !== 477 || height !== 357) fail(`grid dimensions invalid: ${width} x ${height}`);
    }
    if (hash === rejectedSinglePhotoSha256) fail('F5 source image contains one photograph, not nine independent frames');
    if (typeof expectedSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(expectedSha256) || hash !== expectedSha256) {
      fail('binary SHA-256 has not been certified for this exact image');
    }
  }
  if (!Array.isArray(reviewedFrames) || reviewedFrames.length !== 9
    || reviewedFrames.some((s, i) => s?.frame !== i + 1 || typeof s?.visualStage !== 'string' || !s.visualStage.trim())) {
    fail('nine manually verified transformation stages are not documented');
  }
  if (independentReview?.approved !== true || typeof independentReview?.reference !== 'string'
    || !independentReview.reference.startsWith('https://github.com/')) {
    fail('independent visual review has not been documented');
  }
}
if (process.exitCode !== 1) console.log('ATLAS_TRANSFORM_ASSET_GATE: PASS');
