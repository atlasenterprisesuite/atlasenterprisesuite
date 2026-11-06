export function equatorialToHorizontal(input: {raDegrees:number;decDegrees:number;latitudeDegrees:number;longitudeDegrees:number;gmstDegrees:number}): {azimuthDegrees:number;altitudeDegrees:number};
export function observationQuality(input:{ephemerisSource?:string;ephemerisVersion?:string;observedAt?:string}):{status:'computed'|'unverified'};
export function validateLunarImage(input:{type:string;size:number}):{ok:boolean;maxBytes:number};
export function detectImageSignature(bytes:Uint8Array|ArrayBuffer):'image/jpeg'|'image/png'|'image/webp'|null;
export function verifyImageBytes(input:{type:string;size:number;bytes:Uint8Array}):boolean;
export function buildPrivateObservationPath(input:{orgId:string;userId:string;sha256:string}):string;
export function calculateWithProvenance(input:{coordinates:Parameters<typeof equatorialToHorizontal>[0];provenance:{source:string;version:string;observedAt:string}}):ReturnType<typeof equatorialToHorizontal>&{provenance:{source:string;version:string;observedAt:string}};
