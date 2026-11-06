import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeSkyImage, enhanceSkyImage } from '../../apps/web/src/modules/astronomy/skyLensImage.mjs';

const pixels = (...rgba) => new Uint8ClampedArray(rgba.flat());

test('fails closed on invalid dimensions, buffers and unsupported modes', () => {
  assert.throws(() => analyzeSkyImage({ data: pixels([0, 0, 0, 255]), width: 2, height: 1 }), RangeError);
  assert.throws(() => enhanceSkyImage({ data: pixels([0, 0, 0, 255]), width: 1, height: 1, mode: 'invented' }), RangeError);
  assert.throws(() => analyzeSkyImage({ data: pixels([0, 0, 0, 255]), width: Infinity, height: 1 }), RangeError);
});

test('preserves the original and never creates a source from completely black pixels', () => {
  const original = pixels([0, 0, 0, 255], [0, 0, 0, 255]);
  const before = original.slice();
  const improved = enhanceSkyImage({ data: original, width: 2, height: 1, mode: 'explore' });
  assert.deepEqual(original, before);
  assert.deepEqual(improved, before);
  const report = analyzeSkyImage({ data: original, width: 2, height: 1 });
  assert.equal(report.lowSignal, true);
  assert.equal(report.nearBlackFraction, 1);
});

test('protects bright point sources from hallucinated detail and preserves alpha', () => {
  const original = pixels([255, 255, 245, 255], [0, 0, 0, 0], [16, 12, 8, 255]);
  const result = enhanceSkyImage({ data: original, width: 3, height: 1, mode: 'explore' });
  assert.deepEqual(Array.from(result.slice(0, 4)), [255, 255, 245, 255]);
  assert.deepEqual(Array.from(result.slice(4, 8)), [0, 0, 0, 0]);
  assert.equal(result[11], 255);
  assert.ok(result[8] >= 16);
});

test('exploration reveals more mid-tones than natural mode without changing geometry', () => {
  const original = pixels([30, 24, 18, 255], [16, 20, 26, 255]);
  const natural = enhanceSkyImage({ data: original, width: 2, height: 1, mode: 'natural' });
  const explore = enhanceSkyImage({ data: original, width: 2, height: 1, mode: 'explore' });
  assert.ok(explore[0] > natural[0]);
  assert.equal(explore.length, original.length);
  assert.deepEqual(enhanceSkyImage({ data: original, width: 2, height: 1, mode: 'explore' }), explore);
});

test('analyzes saturation and darkness without claiming astronomical identity', () => {
  const original = pixels([255, 255, 255, 255], [3, 3, 3, 255], [12, 15, 22, 255]);
  const report = analyzeSkyImage({ data: original, width: 3, height: 1 });
  assert.equal(report.brightFraction, 1 / 3);
  assert.equal(report.nearBlackFraction, 1 / 3);
  assert.equal(typeof report.p95Luma, 'number');
  assert.ok(!('objectIdentity' in report));
});
