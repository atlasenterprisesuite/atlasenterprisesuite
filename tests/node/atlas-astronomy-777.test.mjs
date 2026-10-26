import { test } from 'node:test';
import assert from 'node:assert/strict';
import { equatorialToHorizontal, observationQuality, validateLunarImage } from '../../apps/web/src/modules/astronomy/astronomyMath.mjs';

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
