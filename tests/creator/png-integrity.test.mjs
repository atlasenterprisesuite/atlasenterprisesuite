import assert from 'node:assert/strict';
import test from 'node:test';
import { deflateSync } from 'node:zlib';
import { assertValidTransformPng } from '../../scripts/creator/png-integrity.mjs';
function crc32(buffer) {
  let crc=0xffffffff;
  for(const byte of buffer) {
    crc^=byte;
    for(let i=0;i<8;i++) crc=(crc>>>1)^((crc&1)?0xedb88320:0);
  }
  return (crc^0xffffffff)>>>0;
}
function chunk(type, data) {
  const size=Buffer.alloc(4); size.writeUInt32BE(data.length);
  const crc=Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type),data])));
  return Buffer.concat([size,Buffer.from(type),data,crc]);
}
function makePng({badStream=false,filter=0,paletteEntries=9,colorType=6}={}) {
  const width=477,height=357,channels=colorType===6?4:1;
  const ihdr=Buffer.alloc(13);
  ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);
  ihdr[8]=8;ihdr[9]=colorType;
  const pixels=Buffer.alloc(height*(1+width*channels));
  for(let y=0;y<height;y++) {
    const base=y*(1+width*channels);pixels[base]=filter;
    for(let x=0;x<width;x++) {
      const p=base+1+x*channels;
      pixels[p]=Math.floor(y/119)*3+Math.floor(x/159);
      if(channels===4) pixels[p+3]=255;
    }
  }
  const parts=[Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',ihdr)];
  if(colorType===3) {
    parts.push(chunk('PLTE', Buffer.from(Array.from({length:3*paletteEntries},(_,i)=>(i*23)%256))));
  }
  parts.push(chunk('IDAT',badStream?Buffer.from('not valid zlib'):deflateSync(pixels)));
  parts.push(chunk('IEND',Buffer.alloc(0)));
  return Buffer.concat(parts);
}
const accept=b=>assert.doesNotThrow(()=>assertValidTransformPng(b));
const reject=b=>assert.throws(()=>assertValidTransformPng(b),/PNG_INVALID/);
test('accepts a complete 477x357 RGBA PNG',()=>accept(makePng()));
test('accepts a complete 8-bit indexed PNG',()=>accept(makePng({colorType:3})));
test('rejects a 24-byte forged PNG header',()=>reject(makePng().subarray(0,24)));
test('rejects truncated IEND chunk',()=>reject(makePng().subarray(0,-5)));
test('rejects corrupted chunk CRC',()=>{const b=makePng();b[38]^=1;reject(b);});
test('rejects invalid compressed image stream with valid CRC',()=>reject(makePng({badStream:true})));
test('rejects invalid scanline filter',()=>reject(makePng({filter:7})));
test('rejects bytes after IEND',()=>reject(Buffer.concat([makePng(),Buffer.from('junk')])));
test('rejects invalid indexed palette value',()=>reject(makePng({colorType:3,paletteEntries:3})));
test('rejects arbitrary data',()=>reject(Buffer.alloc(100)));
