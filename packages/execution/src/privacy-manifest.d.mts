export type PrivacyManifestResult =
  | {status:'blocked';reason:string;labels:string[];verified:false}
  | {status:'declared';labels:string[];verified:false};
export type PrivacyInventoryResult =
  | {status:'blocked';reason:string;verified:false;authorization:'not_evaluated'}
  | {status:'matched_metadata'|'incomplete_metadata';modules:number;observations:number;matched:number;unobservedModules:number;verified:false;authorization:'not_evaluated'};
export function evaluatePrivacyManifest(value:unknown):PrivacyManifestResult;
export function reconcilePrivacyInventory(serialized:unknown):PrivacyInventoryResult;
