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
