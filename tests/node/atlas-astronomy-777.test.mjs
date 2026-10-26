import { test } from 'node:test';
import assert from 'node:assert/strict';
import { equatorialToHorizontal, observationQuality, validateLunarImage, verifyImageBytes } from '../../apps/web/src/modules/astronomy/astronomyMath.mjs';

test('zenith and horizon geometry use degrees', () => {
 const zenith=equatorialToHorizontal({raDegrees:0,decDegrees:0,latitudeDegrees:0,longitudeDegrees:0,gmstDegrees:0});
 assert.ok(Math.abs(zenith.altitudeDegrees-90)<1e-8);
 const horizon=equatorialToHorizontal({raDegrees:90,decDegrees:0,latitudeDegrees:0,longitudeDegrees:0,gmstDegrees:0});
 assert.ok(Math.abs(horizon.altitudeDegrees)<1e-8);
});
test('reject missing or nonfinite astronomical evidence',()=>{
 assert.throws(()=>equatorialToHorizontal({raDegrees:NaN,decDegrees:0,latitudeDegrees:0,longitudeDegrees:0,gmstDegrees:0}));
 assert.throws(()=>equatorialToHorizontal({raDegrees:0,decDegrees:95,latitudeDegrees:0,longitudeDegrees:0,gmstDegrees:0}));
 assert.equal(observationQuality({ephemerisSource:''}).status,'unverified');
});
test('reject untrusted image payloads and oversized files',()=>{
 assert.equal(validateLunarImage({type:'image/svg+xml',size:100}).ok,false);
 assert.equal(validateLunarImage({type:'image/jpeg',size:21*1024*1024}).ok,false);
 assert.equal(validateLunarImage({type:'image/png',size:1024}).ok,true);
});

test('image signature rejects MIME spoofing and truncated payloads',()=>{
 const png=Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,0]);
 assert.equal(verifyImageBytes({type:'image/png',size:png.length,bytes:png}),true);
 assert.equal(verifyImageBytes({type:'image/jpeg',size:png.length,bytes:png}),false);
 assert.equal(verifyImageBytes({type:'image/png',size:png.length+1,bytes:png}),false);
 assert.equal(verifyImageBytes({type:'image/png',size:2,bytes:png.slice(0,2)}),false);
});
test('azimuth uses north-clockwise orientation',()=>{
 const east=equatorialToHorizontal({raDegrees:270,decDegrees:0,latitudeDegrees:0,longitudeDegrees:0,gmstDegrees:0});
 assert.ok(Math.abs(east.azimuthDegrees-90)<1e-8);
});
