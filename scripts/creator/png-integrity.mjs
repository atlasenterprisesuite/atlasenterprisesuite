import { inflateSync } from 'node:zlib';
// Strict, non-interlaced 8-bit PNG decoder for the 477x357 ATLAS sprite.
// Tests image bytes, not artistic suitability or provenance.
const SIGNATURE = Buffer.from('89504e470d0a1a0a', 'hex');
const CHANNELS = new Map([[0,1],[2,3],[3,1],[4,2],[6,4]]);
function ensure(test, message) { if (!test) throw new Error('PNG_INVALID: ' + message); }
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function paeth(a,b,c) {
  const p=a+b-c, da=Math.abs(p-a), db=Math.abs(p-b), dc=Math.abs(p-c);
  return da <= db && da <= dc ? a : (db <= dc ? b : c);
}
export function assertValidTransformPng(bytes) {
  ensure(Buffer.isBuffer(bytes), 'expected PNG bytes');
  ensure(bytes.length >= 57 && bytes.length <= 5 * 1024 * 1024, 'truncated or oversized file');
  ensure(bytes.subarray(0,8).equals(SIGNATURE), 'invalid PNG signature');
  let offset=8, width=0, height=0, colorType=-1, channels=0;
  let ihdr=false, idat=false, endedIdat=false, iend=false, paletteEntries=0;
  const compressed=[];
  while (offset < bytes.length) {
    ensure(offset + 12 <= bytes.length, 'incomplete PNG chunk header');
    const length=bytes.readUInt32BE(offset);
    ensure(length <= bytes.length - offset - 12, 'incomplete PNG chunk body');
    const type=bytes.toString('ascii',offset+4,offset+8);
    ensure(/^[A-Za-z]{4}$/.test(type), 'invalid chunk type');
    ensure(!iend, 'chunks after IEND');
    const payload=bytes.subarray(offset+8,offset+8+length);
    ensure(crc32(bytes.subarray(offset+4,offset+8+length)) === bytes.readUInt32BE(offset+8+length), type + ' CRC mismatch');
    ensure(ihdr || type === 'IHDR', 'IHDR must be first');
    if (idat && type !== 'IDAT') endedIdat=true;
    if (type === 'IHDR') {
      ensure(!ihdr && offset===8 && length===13, 'invalid IHDR');
      ihdr=true;
      width=payload.readUInt32BE(0); height=payload.readUInt32BE(4);
      colorType=payload[9]; channels=CHANNELS.get(colorType) ?? 0;
      ensure(width===477 && height===357, 'unexpected grid dimensions');
      ensure(payload[8]===8 && channels>0, 'unsupported bit depth or color type');
      ensure(payload[10]===0 && payload[11]===0 && payload[12]===0, 'unsupported compression, filter or interlace');
    } else if (type === 'PLTE') {
      ensure(!idat && !paletteEntries && length >= 3 && length % 3 === 0 && length <= 768, 'invalid PLTE');
      ensure(colorType !== 0 && colorType !== 4, 'PLTE not permitted for grayscale');
      paletteEntries=length/3;
    } else if (type === 'IDAT') {
      ensure(!endedIdat && !iend, 'IDAT must be contiguous');
      ensure(colorType !== 3 || paletteEntries > 0, 'indexed PNG requires PLTE');
      idat=true; compressed.push(payload);
    } else if (type === 'IEND') {
      ensure(length===0 && idat, 'invalid IEND');
      iend=true;
      ensure(offset+12===bytes.length, 'trailing bytes after IEND');
    } else {
      ensure(!['acTL','fcTL','fdAT'].includes(type), 'animated PNG not supported');
      ensure(type[0] === type[0].toLowerCase(), 'unsupported critical chunk: ' + type);
    }
    offset += length+12;
  }
  ensure(ihdr && idat && iend, 'missing required chunks');
  const stride=width*channels, expected=height*(stride+1);
  const compressedBytes = Buffer.concat(compressed);
  let decoded, consumed;
  try {
    const result=inflateSync(compressedBytes, { maxOutputLength: expected+1, info: true });
    decoded=result.buffer;
    consumed=result.engine.bytesWritten;
  } catch { throw new Error('PNG_INVALID: invalid compressed pixel data'); }
  ensure(consumed===compressedBytes.length, 'trailing compressed bytes');
  ensure(decoded.length===expected, 'invalid decompressed pixel length');
  let prev=Buffer.alloc(stride);
  for (let y=0;y<height;y++) {
    const start=y*(stride+1), filter=decoded[start];
    ensure(filter<=4, 'invalid PNG scanline filter');
    const row=Buffer.allocUnsafe(stride);
    for(let i=0;i<stride;i++) {
      const sample=decoded[start+1+i], left=i<channels?0:row[i-channels];
      const up=prev[i], ul=i<channels?0:prev[i-channels];
      const prediction=filter===0?0:filter===1?left:filter===2?up:filter===3?Math.floor((left+up)/2):paeth(left,up,ul);
      row[i]=(sample+prediction)&255;
      if(colorType===3) ensure(row[i]<paletteEntries, 'palette index out of range');
    }
    prev=row;
  }
  return Object.freeze({width,height,colorType,verifiedPixels:width*height});
}
