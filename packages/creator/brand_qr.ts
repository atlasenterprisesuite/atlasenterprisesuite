import { validateBrandDestination } from './brand_experience';

/** Offline ISO/IEC 18004 QR byte encoding, medium ECC, versions 1–10. No third-party endpoint. */
export type BrandQr = { modules: boolean[][]; version: number; size: number; destination: string };
const BLOCKS_M: readonly (readonly number[])[] = [
  [1, 26, 16], [1, 44, 28], [1, 70, 44], [2, 50, 32], [2, 67, 43],
  [4, 43, 27], [4, 49, 31], [2, 60, 38, 2, 61, 39],
  [3, 58, 36, 2, 59, 37], [4, 69, 43, 1, 70, 44]
];
const ALIGN: readonly (readonly number[])[] = [
  [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38],
  [6, 24, 42], [6, 26, 46], [6, 28, 50]
];
function gmul(a: number, b: number): number {
  let product = 0;
  for (let i = 0; i < 8; i++) {
    if (b & 1) product ^= a;
    b >>>= 1;
    a = ((a << 1) ^ ((a & 128) ? 0x11d : 0)) & 255;
  }
  return product;
}
function reedSolomon(data: number[], ecc: number): number[] {
  let polynomial = [1];
  let root = 1;
  for (let i = 0; i < ecc; i++) {
    const next = Array<number>(polynomial.length + 1).fill(0);
    polynomial.forEach((v, j) => { next[j] ^= v; next[j + 1] ^= gmul(v, root); });
    polynomial = next;
    root = gmul(root, 2);
  }
  const remainder = Array<number>(ecc).fill(0);
  data.forEach(byte => {
    const factor = byte ^ remainder[0];
    remainder.shift();
    remainder.push(0);
    for (let j = 0; j < ecc; j++) remainder[j] ^= gmul(factor, polynomial[j + 1]);
  });
  return remainder;
}
function encodeData(bytes: Uint8Array, version: number): number[] {
  const spec = BLOCKS_M[version - 1];
  const blocks: { total: number; data: number }[] = [];
  for (let i = 0; i < spec.length; i += 3) {
    for (let n = 0; n < spec[i]; n++) blocks.push({ total: spec[i + 1], data: spec[i + 2] });
  }
  const dataSize = blocks.reduce((n, b) => n + b.data, 0);
  const bits: number[] = [];
  const append = (v: number, count: number) => { for (let i = count - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
  append(4, 4);
  append(bytes.length, version < 10 ? 8 : 16);
  bytes.forEach(b => append(b, 8));
  while (bits.length < dataSize * 8 && bits.length % 8 !== 0) bits.push(0);
  const firstPadByte = Math.ceil((4 + (version < 10 ? 8 : 16) + bytes.length * 8) / 8);
  while (bits.length < dataSize * 8) append((Math.floor(bits.length / 8) - firstPadByte) % 2 === 0 ? 0xec : 0x11, 8);
  const dataWords = Array.from({ length: dataSize }, (_, i) => bits.slice(i * 8, i * 8 + 8).reduce((acc, bit) => acc * 2 + bit, 0));
  const blockData: number[][] = [];
  const blockEcc: number[][] = [];
  let offset = 0;
  for (const b of blocks) {
    const part = dataWords.slice(offset, offset + b.data);
    blockData.push(part);
    blockEcc.push(reedSolomon(part, b.total - b.data));
    offset += b.data;
  }
  const result: number[] = [];
  for (let i = 0; i < Math.max(...blockData.map(x => x.length)); i++) for (const b of blockData) if (i < b.length) result.push(b[i]);
  for (let i = 0; i < Math.max(...blockEcc.map(x => x.length)); i++) for (const b of blockEcc) if (i < b.length) result.push(b[i]);
  return result;
}
function maskAt(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
    case 5: return (x * y) % 2 + (x * y) % 3 === 0;
    case 6: return ((x * y) % 2 + (x * y) % 3) % 2 === 0;
    default: return ((x + y) % 2 + (x * y) % 3) % 2 === 0;
  }
}
function formatBits(mask: number): number {
  let value = mask << 10; // M correction level has format bits 00.
  for (let i = 14; i >= 10; i--) if (((value >>> i) & 1) !== 0) value ^= 0x537 << (i - 10);
  return ((mask << 10) | value) ^ 0x5412;
}
function versionBits(version: number): number {
  let value = version << 12;
  for (let i = 17; i >= 12; i--) if ((value >>> i) & 1) value ^= 0x1f25 << (i - 12);
  return (version << 12) | value;
}
function penalty(matrix: boolean[][]): number {
  const size = matrix.length;
  let score = 0;
  for (let direction = 0; direction < 2; direction++) for (let outer = 0; outer < size; outer++) {
    const line = Array.from({ length: size }, (_, i) => direction ? matrix[i][outer] : matrix[outer][i]);
    let count = 1;
    for (let i = 1; i <= size; i++) {
      if (i < size && line[i] === line[i - 1]) count++;
      else { if (count >= 5) score += 3 + count - 5; count = 1; }
    }
    for (let i = 0; i + 10 < size; i++) {
      const pattern = line.slice(i, i + 11).map(v => v ? 1 : 0).join('');
      if (pattern === '10111010000' || pattern === '00001011101') score += 40;
    }
  }
  for (let y = 0; y + 1 < size; y++) for (let x = 0; x + 1 < size; x++) if (
    matrix[y][x] === matrix[y][x + 1] && matrix[y][x] === matrix[y + 1][x] && matrix[y][x] === matrix[y + 1][x + 1]
  ) score += 3;
  const dark = matrix.flat().filter(Boolean).length;
  score += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
  return score;
}
export function buildBrandQr(value: string): BrandQr | null {
  const destination = validateBrandDestination(value);
  if (!destination) return null;
  const bytes = new TextEncoder().encode(destination);
  const version = BLOCKS_M.findIndex((spec, index) => {
    let cap = 0;
    for (let i = 0; i < spec.length; i += 3) cap += spec[i] * spec[i + 2];
    return (4 + (index < 9 ? 8 : 16) + bytes.length * 8) <= cap * 8;
  }) + 1;
  if (!version) return null;
  const codewords = encodeData(bytes, version);
  const size = version * 4 + 17;
  const base = Array.from({ length: size }, () => Array<boolean | null>(size).fill(null));
  const put = (x: number, y: number, dark: boolean) => { if (x >= 0 && y >= 0 && x < size && y < size) base[y][x] = dark; };
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const radius = Math.max(Math.abs(dx), Math.abs(dy));
      put(cx + dx, cy + dy, radius !== 2 && radius !== 4);
    }
  };
  finder(3, 3);
  finder(size - 4, 3);
  finder(3, size - 4);
  // Alignment patterns must be laid down before timing patterns (which cross alignment centers).
  for (const y of ALIGN[version - 1]) for (const x of ALIGN[version - 1]) {
    if (base[y][x] !== null) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) put(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  for (let i = 8; i < size - 8; i++) {
    if (base[i][6] === null) put(6, i, i % 2 === 0);
    if (base[6][i] === null) put(i, 6, i % 2 === 0);
  }
  for (let i = 0; i < 9; i++) if (i !== 6) { put(8, i, false); put(i, 8, false); }
  for (let i = 0; i < 8; i++) { put(8, size - 1 - i, false); put(size - 1 - i, 8, false); }
  put(8, size - 8, true);
  if (version >= 7) {
    const bits = versionBits(version);
    for (let i = 0; i < 18; i++) {
      put(size - 11 + i % 3, Math.floor(i / 3), Boolean((bits >>> i) & 1));
      put(Math.floor(i / 3), size - 11 + i % 3, Boolean((bits >>> i) & 1));
    }
  }
  const data = base.map(row => row.slice());
  let byte = 0;
  let bit = 7;
  let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col = 5;
    for (let k = 0; k < size; k++) {
      const row = upward ? size - 1 - k : k;
      for (const x of [col, col - 1]) {
        if (base[row][x] !== null) continue;
        data[row][x] = byte < codewords.length ? Boolean((codewords[byte] >>> bit) & 1) : false;
        if (--bit < 0) { bit = 7; byte++; }
      }
    }
    upward = !upward;
  }
  let bestScore = Infinity;
  let best: boolean[][] | null = null;
  for (let mask = 0; mask < 8; mask++) {
    const matrix = data.map((row, y) => row.map((v, x) => base[y][x] === null && maskAt(mask, x, y) ? !v : v) as boolean[]);
    const format = formatBits(mask);
    for (let i = 0; i < 15; i++) {
      const dark = Boolean((format >>> i) & 1);
      const vy = i < 6 ? i : i < 8 ? i + 1 : size - 15 + i;
      matrix[vy][8] = dark;
      const hx = i < 8 ? size - 1 - i : i === 8 ? 7 : 14 - i;
      matrix[8][hx] = dark;
    }
    matrix[size - 8][8] = true;
    const score = penalty(matrix);
    if (score < bestScore) { bestScore = score; best = matrix; }
  }
  if (!best) return null;
  return { modules: best, version, size, destination };
}
/** Four-module quiet zone; no scripts, remote links or user text are embedded in SVG. */
export function renderBrandQrSvg(qr: BrandQr): string {
  const size = qr.size + 8;
  const pixels = qr.modules.flatMap((row, y) => row.flatMap((dark, x) => dark ? ['M' + (x + 4) + ',' + (y + 4) + 'h1v1h-1z'] : [])).join('');
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + (size * 8) + '" height="' + (size * 8) + '" viewBox="0 0 ' + size + ' ' + size + '" shape-rendering="crispEdges"><rect width="' + size + '" height="' + size + '" fill="#fff"/><path d="' + pixels + '" fill="#000"/></svg>';
}
