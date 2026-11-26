// Manufacturer-backed model specifications. These are NOT vehicle-identification results
// and must never be joined to dealership inventory or accounting records without verification.
export type VehicleSpecification = {
 readonly id: string;
 readonly manufacturer: 'McLaren';
 readonly model: string;
 readonly body: 'Spider';
 readonly engine: string;
 readonly powerPs: number;
 readonly powerBhp: number;
 readonly accelerationZeroToHundredSeconds: number;
 readonly topSpeedKmh: number;
 readonly specSourceUrl: string;
 readonly specReviewDate: '2026-11-26';
 readonly marketPriceUsd: null;
 readonly individualVin: null;
};

export const vehicleCatalog: readonly VehicleSpecification[] = [
 {
  id: 'mclaren-720s-spider', manufacturer: 'McLaren', model: '720S Spider',
  body: 'Spider', engine: '4.0 L V8 biturbo', powerPs: 720, powerBhp: 710,
  accelerationZeroToHundredSeconds: 2.8, topSpeedKmh: 341,
  specSourceUrl: 'https://cars.mclaren.com/gl_en/legacy/720s-spider',
  specReviewDate: '2026-11-26', marketPriceUsd: null, individualVin: null
 },
 {
  id: 'mclaren-750s-spider', manufacturer: 'McLaren', model: '750S Spider',
  body: 'Spider', engine: '4.0 L V8 biturbo', powerPs: 750, powerBhp: 740,
  accelerationZeroToHundredSeconds: 2.8, topSpeedKmh: 332,
  specSourceUrl: 'https://cars.mclaren.com/uk_en/750s-spider',
  specReviewDate: '2026-11-26', marketPriceUsd: null, individualVin: null
 }
] as const;

export function getVehicleSpecification(id: string): VehicleSpecification | undefined {
 return vehicleCatalog.find(vehicle => vehicle.id === id);
}

export type VehicleDossier = {
 schema: 'atlas.automotive.dossier.v1';
 identification: {
  method: 'human-selected-candidate';
  visualRecognitionPerformed: false;
  confidencePercent: null;
  vinVerified: false;
 };
 photo: { name: string | null; storedOrUploaded: false };
 vehicle: VehicleSpecification;
 source: { type: 'official-manufacturer'; url: string; reviewedOn: string };
 market: { priceUsd: null; availability: 'not-verified' };
 scientificReview: 'model-specifications-only';
};

export function buildVehicleDossier(id: string, photoName?: string | null): VehicleDossier | null {
 const vehicle=getVehicleSpecification(id);
 if (!vehicle) return null; // Fail-closed on unknown or unverified model.
 return {
  schema: 'atlas.automotive.dossier.v1',
  identification: {method:'human-selected-candidate', visualRecognitionPerformed:false, confidencePercent:null, vinVerified:false},
  photo: {name:photoName?.slice(0,160)||null, storedOrUploaded:false},
  vehicle: {...vehicle},
  source: {type:'official-manufacturer',url:vehicle.specSourceUrl,reviewedOn:vehicle.specReviewDate},
  market: {priceUsd:null,availability:'not-verified'},
  scientificReview:'model-specifications-only'
 };
}
