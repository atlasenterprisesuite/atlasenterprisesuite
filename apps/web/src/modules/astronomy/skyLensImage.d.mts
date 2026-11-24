export type SkyImageInput = { data: Uint8ClampedArray; width: number; height: number };
export type SkyEnhancementMode = 'natural' | 'explore';
export type SkyExposureAnalysis = {
  p95Luma: number;
  nearBlackFraction: number;
  brightFraction: number;
  lowSignal: boolean;
};
export function analyzeSkyImage(image: SkyImageInput): SkyExposureAnalysis;
export function enhanceSkyImage(image: SkyImageInput & { mode?: SkyEnhancementMode }): Uint8ClampedArray;
