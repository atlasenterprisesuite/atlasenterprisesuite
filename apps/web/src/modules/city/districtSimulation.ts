/**
 * Synthetic-only spatial fixtures for the Orlando Digital District demonstration.
 * Coordinates are illustrative, NOT surveyed assets, sensors, public infrastructure,
 * municipal status or real-time feeds.
 */
export type DistrictMode = 'simulation' | 'live';
export type DistrictLayer = 'mobility' | 'infrastructure' | 'buildings' | 'network' | 'community';

export type DistrictSimulationPoint = {
  id: string;
  label: string;
  kind: string;
  layer: DistrictLayer | 'core';
  coordinates: readonly [number, number];
};

export const SIMULATION_POINTS: readonly DistrictSimulationPoint[] = [
  { id: 'core', label: 'Lake Eola simulation center', coordinates: [-81.3732, 28.5439], kind: 'Command simulation', layer: 'core' },
  { id: 'mobility', label: 'Mobility sandbox', coordinates: [-81.3762, 28.5419], kind: 'Mobility simulation', layer: 'mobility' },
  { id: 'infrastructure', label: 'Infrastructure sandbox', coordinates: [-81.3698, 28.5456], kind: 'Infrastructure simulation', layer: 'infrastructure' },
  { id: 'buildings', label: 'Building twin sandbox', coordinates: [-81.3748, 28.5468], kind: 'Building simulation', layer: 'buildings' },
  { id: 'network', label: 'Network sandbox', coordinates: [-81.3709, 28.5414], kind: 'Network simulation', layer: 'network' },
  { id: 'community', label: 'Community sandbox', coordinates: [-81.3774, 28.5454], kind: 'Community simulation', layer: 'community' }
];

export function getVisibleDistrictSimulationPoints(
  mode: DistrictMode,
  activeLayers: Readonly<Record<DistrictLayer, boolean>>
): DistrictSimulationPoint[] {
  if (mode !== 'simulation') return [];
  return SIMULATION_POINTS.filter((point) => point.layer === 'core' || activeLayers[point.layer] === true);
}
