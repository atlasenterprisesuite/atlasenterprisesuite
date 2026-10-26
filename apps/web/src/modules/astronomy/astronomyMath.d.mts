export function equatorialToHorizontal(input: {raDegrees:number;decDegrees:number;latitudeDegrees:number;longitudeDegrees:number;gmstDegrees:number}): {azimuthDegrees:number;altitudeDegrees:number};
export function observationQuality(input:{ephemerisSource?:string;ephemerisVersion?:string;observedAt?:string}):{status:'computed'|'unverified'};
export function validateLunarImage(input:{type:string;size:number}):{ok:boolean;maxBytes:number};
export function detectImageSignature(bytes:Uint8Array|ArrayBuffer):'image/jpeg'|'image/png'|'image/webp'|null;
export function verifyImageBytes(input:{type:string;size:number;bytes:Uint8Array}):boolean;
