import { test } from 'node:test';
import assert from 'node:assert/strict';
import { equatorialToHorizontal, observationQuality, validateLunarImage, verifyImageBytes, calculateWithProvenance, buildPrivateObservationPath } from '../../apps/web/src/modules/astronomy/astronomyMath.mjs';

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
 const east=equatorialToHorizontal({raDegrees:90,decDegrees:0,latitudeDegrees:0,longitudeDegrees:0,gmstDegrees:0});
 assert.ok(Math.abs(east.azimuthDegrees-90)<1e-8);
});

test('ephemeris provenance requires a supported source, immutable version and observation time',()=>{
 const coords={raDegrees:0,decDegrees:0,latitudeDegrees:0,longitudeDegrees:0,gmstDegrees:0};
 assert.throws(()=>calculateWithProvenance({coordinates:coords,provenance:{source:'NASA JPL Horizons',version:'',observedAt:'2026-10-25T21:29:00-04:00'}}));
 assert.throws(()=>calculateWithProvenance({coordinates:coords,provenance:{source:'untrusted',version:'v1',observedAt:'2026-10-25T21:29:00-04:00'}}));
 const r=calculateWithProvenance({coordinates:coords,provenance:{source:'NASA JPL Horizons',version:'DE440',observedAt:'2026-10-25T21:29:00-04:00'}});
 assert.equal(r.provenance.source,'NASA JPL Horizons');
 assert.equal(r.altitudeDegrees,90);
});
test('private observation keys reject cross-tenant path injection and invalid hashes',()=>{
 const org='11111111-1111-4111-8111-111111111111',user='22222222-2222-4222-8222-222222222222',digest='a'.repeat(64);
 assert.equal(buildPrivateObservationPath({orgId:org,userId:user,sha256:digest}),org+'/'+user+'/'+digest);
 assert.throws(()=>buildPrivateObservationPath({orgId:'../other',userId:user,sha256:digest}));
 assert.throws(()=>buildPrivateObservationPath({orgId:org,userId:user,sha256:'a'.repeat(63)}));
});
