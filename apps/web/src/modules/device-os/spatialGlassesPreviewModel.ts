// Presentation-only simulation. This module never authorizes hardware or tenant access.
export type SpatialGlassesSceneId = 'workspace' | 'navigation' | 'assistant';
export type SpatialGlassesRuntime = 'browser-preview' | 'specs' | 'visionos';

export type SpatialGlassesScene = {
  id: SpatialGlassesSceneId;
  label: string;
  heading: string;
  description: string;
  indicators: readonly string[];
};

export const SPATIAL_GLASSES_SCENES: readonly SpatialGlassesScene[] = [
  {
    id: 'workspace', label: 'Workspace', heading: 'Enterprise cockpit',
    description: 'Illustrative modules only. No enterprise records are loaded.',
    indicators: ['Identity: not connected', 'Tenant data: unavailable', 'Actions: disabled']
  },
  {
    id: 'navigation', label: 'Navigation', heading: 'Spatial wayfinding',
    description: 'Concept view only. No position, map, directions or live routing.',
    indicators: ['Location: unavailable', 'Route: not calculated', 'Physical guidance: disabled']
  },
  {
    id: 'assistant', label: 'Assistant', heading: 'Contextual assistance',
    description: 'Illustrative assistant panel. No microphone or AI provider is connected.',
    indicators: ['Microphone: off', 'AI session: not connected', 'External tools: disabled']
  }
];

export type SpatialGlassesPreviewDecision =
  | { state: 'simulation'; scene: SpatialGlassesScene; hardwareConnected: false; externalActionsAllowed: false }
  | { state: 'blocked'; reason: 'external_runtime_not_verified' | 'unknown_scene'; hardwareConnected: false; externalActionsAllowed: false };

export function resolveSpatialGlassesPreview(
  sceneId: string,
  runtime: SpatialGlassesRuntime = 'browser-preview'
): SpatialGlassesPreviewDecision {
  // Neither an SDK presence hint nor client-side values can attest real device authorization.
  if (runtime !== 'browser-preview') {
    return { state: 'blocked', reason: 'external_runtime_not_verified', hardwareConnected: false, externalActionsAllowed: false };
  }
  const scene = SPATIAL_GLASSES_SCENES.find((entry) => entry.id === sceneId);
  if (!scene) {
    return { state: 'blocked', reason: 'unknown_scene', hardwareConnected: false, externalActionsAllowed: false };
  }
  return { state: 'simulation', scene, hardwareConnected: false, externalActionsAllowed: false };
}
