/**
 * ATLAS Safe Glob (original clean-room implementation).
 * Strict subset: literals, ?, *, **, backslash escaping. No regex, braces,
 * character classes, extglobs, negation, or platform-specific normalization.
 * Never use this as a drop-in replacement for picomatch/Vite/Vitest.
 */
export const LIMITS = Object.freeze({ maxPatternChars: 256, maxInputChars: 4096, maxCells: 131072 });
const META = new Set(['(', ')', '[', ']', '{', '}', '!', '+', '|']);
function fail(reason) { throw new RangeError(reason); }

export function compileAtlasGlob(pattern) {
  if (typeof pattern !== 'string') throw new TypeError('Pattern must be a string');
  const chars = Array.from(pattern);
  if (chars.length > LIMITS.maxPatternChars) fail('Pattern exceeds bound');
  const tokens = [];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (c === '\\') {
      if (i + 1 >= chars.length) fail('Dangling escape');
      tokens.push({ kind: 'literal', char: chars[++i] });
    } else if (c === '*') {
      let run = 1;
      while (chars[i + 1] === '*') { i++; run++; }
      tokens.push({ kind: run === 1 ? 'star' : 'globstar' });
    } else if (c === '?') {
      tokens.push({ kind: 'question' });
    } else if (META.has(c)) {
      fail('Unsupported pattern syntax');
    } else {
      tokens.push({ kind: 'literal', char: c });
    }
  }
  return Object.freeze(tokens.map(x => Object.freeze(x)));
}

export function atlasGlobMatch(pattern, input) {
  const tokens = compileAtlasGlob(pattern);
  if (typeof input !== 'string') throw new TypeError('Input must be a string');
  const chars = Array.from(input);
  if (chars.length > LIMITS.maxInputChars) fail('Input exceeds bound');
  if ((tokens.length + 1) * (chars.length + 1) > LIMITS.maxCells) fail('Match work exceeds bound');
  let prev = new Uint8Array(chars.length + 1);
  prev[0] = 1;
  for (const token of tokens) {
    const next = new Uint8Array(chars.length + 1);
    if (token.kind === 'star' || token.kind === 'globstar') {
      next[0] = prev[0];
      for (let j = 1; j <= chars.length; j++) {
        const canConsume = token.kind === 'globstar' || chars[j - 1] !== '/';
        next[j] = prev[j] || (canConsume && next[j - 1]) ? 1 : 0;
      }
    } else {
      for (let j = 1; j <= chars.length; j++) {
        const c = chars[j - 1];
        const match = token.kind === 'literal' ? c === token.char : c !== '/';
        next[j] = prev[j - 1] && match ? 1 : 0;
      }
    }
    prev = next;
  }
  return prev[chars.length] === 1;
}
