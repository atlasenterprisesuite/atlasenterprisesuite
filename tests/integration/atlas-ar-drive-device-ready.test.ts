import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const manifest = readFileSync('unity/atlas-ar-drive/Packages/manifest.json', 'utf8');
const readiness = readFileSync('unity/atlas-ar-drive/Assets/ATLAS/Runtime/AtlasArDriveReadiness.cs', 'utf8');
const builder = readFileSync('unity/atlas-ar-drive/Assets/ATLAS/Editor/AtlasArDriveSceneBuilder.cs', 'utf8');
const build = readFileSync('unity/atlas-ar-drive/Assets/ATLAS/Editor/AtlasArDriveBuild.cs', 'utf8');
const geospatial = readFileSync('unity/atlas-ar-drive/Assets/ATLAS/Runtime/AtlasGeospatialRouteRenderer.cs', 'utf8');
const local = readFileSync('unity/atlas-ar-drive/Assets/ATLAS/Runtime/AtlasLocalRouteRenderer.cs', 'utf8');
const shader = readFileSync('unity/atlas-ar-drive/Assets/ATLAS/Shaders/NeonArrow.shader', 'utf8');
const androidManifest = readFileSync('unity/atlas-ar-drive/Assets/Plugins/Android/AndroidManifest.xml', 'utf8');

describe('ATLAS AR Drive device-ready contract', () => {
  it('pins released XR Plugin Management and supported AR Foundation 6 stack', () => {
    expect(manifest).toContain('"com.unity.xr.management": "4.5.3"');
    expect(manifest).toContain('"com.unity.xr.arfoundation": "6.3.1"');
    expect(manifest).toContain('arcore-unity-extensions.git#arf6');
  });

  it('requires explicit geospatial consent and checks support/tracking', () => {
    expect(readiness).toContain('ConsentRequired');
    expect(readiness).toContain('GrantConsent()');
    expect(readiness).toContain('IsGeospatialModeSupported(GeospatialMode.Enabled)');
    expect(readiness).toContain('EarthTrackingState != TrackingState.Tracking');
    expect(readiness).toContain('Input.location.Start');
  });

  it('generates the required AR scene graph and build assets', () => {
    expect(builder).toContain('AR Session');
    expect(builder).toContain('ARInputManager');
    expect(builder).toContain('XR Origin (AR)');
    expect(builder).toContain('ARCameraManager');
    expect(builder).toContain('ARCameraBackground');
    expect(builder).toContain('AtlasRouteArrow.prefab');
    expect(builder).toContain('AtlasARCoreExtensionsConfig.asset');
  });

  it('automates mobile permissions, XR loaders and CI build methods', () => {
    expect(build).toContain('UnityEngine.XR.ARCore.ARCoreLoader');
    expect(build).toContain('UnityEngine.XR.ARKit.ARKitLoader');
    expect(build).toContain('cameraUsageDescription');
    expect(build).toContain('locationUsageDescription');
    expect(build).toContain('BuildAndroidCI');
    expect(build).toContain('BuildIOSCI');
  });

  it('requests required Android camera/location/ARCore capabilities', () => {
    expect(androidManifest).toContain('android.permission.CAMERA');
    expect(androidManifest).toContain('android.permission.ACCESS_FINE_LOCATION');
    expect(androidManifest).toContain('android.hardware.camera.ar');
    expect(androidManifest).toContain('com.google.ar.core');
  });

  it('keeps route arrows on the road plane instead of vertical/floating at camera height', () => {
    expect(geospatial).toContain('cameraHeightAboveRoadM');
    expect(geospatial).toContain('- cameraHeightAboveRoadM');
    expect(geospatial).toContain('Quaternion.Euler(0f, bearing, 0f)');
    expect(local).toContain('Quaternion.Euler(0f, bearing, 0f)');
    expect(shader).toContain('Cull Off');
  });
});
