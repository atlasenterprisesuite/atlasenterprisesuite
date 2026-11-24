import test from 'node:test';
import assert from 'node:assert/strict';
import { atlasGlobMatch, compileAtlasGlob, LIMITS } from './safe-glob.mjs';

test('literal and wildcards match within segments', () => {
  assert.equal(atlasGlobMatch('src/*.ts', 'src/index.ts'), true);
  assert.equal(atlasGlobMatch('src/*.ts', 'src/core/index.ts'), false);
  assert.equal(atlasGlobMatch('src/?.ts', 'src/a.ts'), true);
  assert.equal(atlasGlobMatch('src/?.ts', 'src/ab.ts'), false);
  assert.equal(atlasGlobMatch('src/**/app.ts', 'src/core/app.ts'), true);
  assert.equal(atlasGlobMatch('src/**/app.ts', 'src/core/nested/app.ts'), true);
  assert.equal(atlasGlobMatch('src/**/app.ts', 'src/app.ts'), false); // explicit slash is required
  assert.equal(atlasGlobMatch('**', ''), true);
});

test('escape special characters and reject unsupported syntax', () => {
  assert.equal(atlasGlobMatch('a\\*b', 'a*b'), true);
  assert.equal(atlasGlobMatch('a\\?b', 'a?b'), true);
  assert.throws(() => compileAtlasGlob('+(*)'), /Unsupported/);
  assert.throws(() => compileAtlasGlob('+(\\u002aa)'), /Unsupported/);
  assert.throws(() => compileAtlasGlob('a{b,c}'), /Unsupported/);
  assert.throws(() => compileAtlasGlob('x['), /Unsupported/);
  assert.throws(() => compileAtlasGlob('x\\'), /Dangling/);
});

test('adversarial repeated stars never generate a regex', () => {
  const malicious = '*a'.repeat(100) + 'z';
  assert.equal(atlasGlobMatch(malicious, 'a'.repeat(100) + 'y'), false);
  assert.equal(atlasGlobMatch('**'.repeat(100), 'x'.repeat(500)), true);
});

test('enforce work and input limits before computing', () => {
  assert.throws(() => atlasGlobMatch('a'.repeat(257), 'x'), /Pattern exceeds/);
  assert.throws(() => atlasGlobMatch('a', 'x'.repeat(4097)), /Input exceeds/);
  assert.throws(() => atlasGlobMatch('a'.repeat(150), 'x'.repeat(1000)), /Match work exceeds/);
  assert.throws(() => atlasGlobMatch('a', 5), TypeError);
  assert.equal(LIMITS.maxCells, 131072);
});

test('Unicode code points are handled without partial surrogate matching', () => {
  assert.equal(atlasGlobMatch('?.txt', '🌎.txt'), true);
  assert.equal(atlasGlobMatch('?.txt', '🌎🌎.txt'), false);
});
