// Pure, reproducible equatorial-to-horizontal coordinate transform.
// Input GMST and apparent equatorial coordinates MUST come from a documented ephemeris.
const rad = Math.PI / 180;
const normalize = degrees => ((degrees % 360) + 360) % 360;
export function equatorialToHorizontal({raDegrees,decDegrees,latitudeDegrees,longitudeDegrees,gmstDegrees}) {
 const numbers=[raDegrees,decDegrees,latitudeDegrees,longitudeDegrees,gmstDegrees];
 if(numbers.some(v=>typeof v!=='number'||!Number.isFinite(v))||Math.abs(decDegrees)>90||Math.abs(latitudeDegrees)>90||Math.abs(longitudeDegrees)>180) throw new RangeError('Invalid astronomical coordinates');
 const hourAngle=normalize(gmstDegrees+longitudeDegrees-raDegrees)*rad;
 const dec=decDegrees*rad, lat=latitudeDegrees*rad;
 const east=-Math.cos(dec)*Math.sin(hourAngle);
 const north=Math.sin(dec)*Math.cos(lat)-Math.cos(dec)*Math.cos(hourAngle)*Math.sin(lat);
 const up=Math.sin(dec)*Math.sin(lat)+Math.cos(dec)*Math.cos(hourAngle)*Math.cos(lat);
 return {azimuthDegrees:normalize(Math.atan2(east,north)/rad),altitudeDegrees:Math.asin(Math.max(-1,Math.min(1,up)))/rad};
}
export function observationQuality({ephemerisSource,ephemerisVersion,observedAt}) {
 return {status:ephemerisSource&&ephemerisVersion&&observedAt?'computed':'unverified'};
}
export function validateLunarImage({type,size}) {
 const allowed=['image/jpeg','image/png','image/webp'];
 return {ok:allowed.includes(type)&&Number.isSafeInteger(size)&&size>0&&size<=20*1024*1024, maxBytes:20*1024*1024};
}

export function detectImageSignature(bytes) {
 const b=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
 if(b.length>=3&&b[0]===255&&b[1]===216&&b[2]===255)return 'image/jpeg';
 if(b.length>=8&&[137,80,78,71,13,10,26,10].every((n,i)=>b[i]===n))return 'image/png';
 if(b.length>=12&&String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP')return 'image/webp';
 return null;
}
export function verifyImageBytes({type,size,bytes}) {
 return validateLunarImage({type,size}).ok && bytes.byteLength===size && detectImageSignature(bytes)===type;
}

const uuidPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function buildPrivateObservationPath({orgId,userId,sha256}) {
 if(!uuidPattern.test(orgId)||!uuidPattern.test(userId)||!/^[a-f0-9]{64}$/.test(sha256)) throw new Error('Invalid tenant-scoped original identity');
 return orgId.toLowerCase()+'/'+userId.toLowerCase()+'/'+sha256;
}
export function calculateWithProvenance({coordinates,provenance}) {
 if(!provenance || provenance.source!=='NASA JPL Horizons'||typeof provenance.version!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._-]{1,63}$/.test(provenance.version)||typeof provenance.observedAt!=='string'||!/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:Z|[+-]\\d{2}:\\d{2})$/.test(provenance.observedAt)||!Number.isFinite(Date.parse(provenance.observedAt))) throw new Error('Verified ephemeris provenance required');
 return {...equatorialToHorizontal(coordinates),provenance:{...provenance}};
}
