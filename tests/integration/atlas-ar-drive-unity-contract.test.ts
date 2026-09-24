import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const manifest = readFileSync('unity/atlas-ar-drive/Packages/manifest.json', 'utf8');
const projectVersion = readFileSync('unity/atlas-ar-drive/ProjectSettings/ProjectVersion.txt', 'utf8');
const shader = readFileSync('unity/atlas-ar-drive/Assets/ATLAS/Shaders/NeonArrow.shader', 'utf8');
const routeClient = readFileSync('unity/atlas-ar-drive/Assets/ATLAS/Runtime/AtlasRouteClient.cs', 'utf8');
const geoRenderer = readFileSync('unity/atlas-ar-drive/Assets/ATLAS/Runtime/AtlasGeospatialRouteRenderer.cs', 'utf8');
const localRenderer = readFileSync('unity/atlas-ar-drive/Assets/ATLAS/Runtime/AtlasLocalRouteRenderer.cs', 'utf8');
const backend = readFileSync('supabase/functions/atlas-gps/index.ts', 'utf8');

describe('ATLAS AR Drive Unity contract', () => {
  it('pins a Unity 6.3 LTS + AR Foundation 6 compatible baseline', () => {
    expect(projectVersion).toContain('6000.3.0f1');
    expect(manifest).toContain('"com.unity.xr.arfoundation": "6.3.1"');
    expect(manifest).toContain('"com.unity.xr.arcore": "6.3.1"');
    expect(manifest).toContain('"com.unity.xr.arkit": "6.3.1"');
    expect(manifest).toContain('arcore-unity-extensions.git#arf6');
  });

  it('does not depend on the inactive Mapbox Unity v2 SDK', () => {
    expect(manifest).not.toContain('mapbox');
  });

  it('implements additive neon route rendering in URP', () => {
    expect(shader).toContain('Shader "ATLAS/AR/NeonArrow"');
    expect(shader).toContain('Blend One One');
    expect(shader).toContain('RenderPipeline\"=\"UniversalPipeline');
    expect(shader).toContain('_FresnelPower');
    expect(shader).toContain('_PulseSpeed');
  });

  it('keeps route authentication inside the ATLAS boundary', () => {
    expect(routeClient).toContain('Authorization');
    expect(routeClient).toContain('x-atlas-org-id');
    expect(routeClient).toContain('Configure(string endpoint, string orgId, string token)');
    expect(routeClient).not.toContain('TU_MAPBOX');
    expect(routeClient).not.toContain('maps.googleapis.com');
  });

  it('returns Unity-friendly route waypoints from the ATLAS backend', () => {
    expect(backend).toContain('waypoints: Array.isArray(route.geometry?.coordinates)');
    expect(backend).toContain('lat: Number(pair[1])');
    expect(backend).toContain('lon: Number(pair[0])');
  });

  it('uses geospatial anchors with a local-meter fallback', () => {
    expect(geoRenderer).toContain('AREarthManager');
    expect(geoRenderer).toContain('EarthTrackingState');
    expect(geoRenderer).toContain('ARAnchorManagerExtensions.AddAnchor');
    expect(localRenderer).toContain('GeoMath.ToLocalMeters');
  });
});
