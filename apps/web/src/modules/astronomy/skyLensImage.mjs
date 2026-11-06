// ATLAS SKY LENS: deterministic client-side tone mapping, not planetary reconstruction.
// Input/output pixels remain in the same coordinate system; no generative synthesis.
const MAX_PIXELS = 16_000_000;
const MODES = Object.freeze({ natural: { gamma: 0.81, maxGain: 2.7, floor: 6 }, explore: { gamma: 0.58, maxGain: 5, floor: 2 } });
function validate({ data, width, height }) {
  if (!(data instanceof Uint8ClampedArray) || !Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 || width * height > MAX_PIXELS || data.length !== width * height * 4) {
    throw new RangeError('Invalid or oversized RGBA image');
  }
}
const luma = (r, g, b) => Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
export function analyzeSkyImage({ data, width, height }) {
  validate({ data, width, height });
  const histogram = new Uint32Array(256);
  let nearBlack = 0, bright = 0, visible = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const y = luma(data[i], data[i + 1], data[i + 2]);
    histogram[y]++;
    if (y <= 4) nearBlack++;
    if (y >= 245) bright++;
    visible++;
  }
  let p95Luma = 0, cumulative = 0;
  for (let v = 0; v < 256 && visible > 0; v++) {
    cumulative += histogram[v];
    if (cumulative >= Math.ceil(visible * 0.95)) { p95Luma = v; break; }
  }
  return { p95Luma, nearBlackFraction: visible ? nearBlack / visible : 1, brightFraction: visible ? bright / visible : 0, lowSignal: p95Luma < 12 };
}
export function enhanceSkyImage({ data, width, height, mode = 'natural' }) {
  validate({ data, width, height });
  if (!Object.hasOwn(MODES, mode)) throw new RangeError('Unsupported image enhancement mode');
  const { gamma, maxGain, floor } = MODES[mode];
  const result = data.slice();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const y = luma(r, g, b);
    // Black pixels contain no recoverable signal. Bright stars stay unchanged.
    if (y <= floor || Math.max(r, g, b) >= 225) continue;
    const corrected = 255 * Math.pow(y / 255, gamma);
    const gain = Math.min(maxGain, corrected / Math.max(y, 1));
    const ramp = Math.min(1, (y - floor) / 20);
    const multiplier = 1 + (gain - 1) * ramp;
    result[i] = Math.min(255, Math.round(r * multiplier));
    result[i + 1] = Math.min(255, Math.round(g * multiplier));
    result[i + 2] = Math.min(255, Math.round(b * multiplier));
    // Preserve the alpha channel; never infer celestial details.
  }
  return result;
}
