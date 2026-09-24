# ATLAS AR Drive — Unity

Cross-platform augmented-reality navigation layer for ATLAS GPS 4D.

## Baseline

- Unity 6.3 LTS (6000.3.0f1)
- AR Foundation 6.3.1
- ARCore XR Plugin 6.3.1
- ARKit XR Plugin 6.3.1
- XR Plugin Management 4.5.3
- Google ARCore Extensions for AR Foundation via #arf6
- URP
- Input System

## Automated setup

Open unity/atlas-ar-drive with Unity 6.3 LTS and run:

ATLAS > AR Drive > Configure Project

This command:
- generates the AR scene, route-arrow prefab, neon material, mini-map material and Geospatial config;
- creates AR Session, ARInputManager, XR Origin, AR camera, ARCore Extensions, Earth/Anchor managers and route renderers;
- enables ARCore for Android and ARKit for iOS through XR Plugin Management;
- configures iOS camera/location descriptions;
- configures Android ARM64 + IL2CPP + API 26 minimum;
- enables both input systems as required by the AR Foundation 6 upgrade guidance;
- registers the generated scene in Build Settings;
- runs a fail-closed project validation.

Command-line build methods:
- AtlasArDriveBuild.BuildAndroidCI
- AtlasArDriveBuild.BuildIOSCI

## Runtime flow

ATLAS Navigation Engine / ATLAS GPS API
→ authenticated route response
→ waypoints[{lat,lon}]
→ Unity AR Drive
→ ARCore/ARKit tracking
→ Geospatial anchors when available
→ local-meter fallback otherwise
→ neon route arrows
→ lower route mini-map

## Consent and device readiness

`AtlasArDriveReadiness` keeps Geospatial disabled until the user explicitly allows AR camera/location use. It checks whether Geospatial mode is supported, starts precise location, waits for Earth tracking, and exposes a runtime state instead of pretending tracking is ready.

The generated Android manifest requests camera, precise/coarse location and internet and marks ARCore as required. iOS permission text is set by the project configurator.

## Road alignment

AR arrows are horizontal on the road plane and rotate only by route bearing. The first Geospatial implementation estimates road altitude by subtracting a configurable camera-above-road height from the current camera geospatial altitude. This is a bounded MVT approximation, not a claim of centimeter-level lane alignment.

For supported devices/locations, Geospatial/VPS improves localization. If Earth tracking is unavailable, ATLAS can fall back to local-meter projection but must label that state as degraded/local rather than VPS verified.

## Routing and secrets

Unity does not call Google or Mapbox Routes directly. It calls the authenticated ATLAS GPS backend. Provider credentials remain server-side, preserving tenant/RBAC boundaries and allowing routing providers to be replaced without changing the client contract.

## Neon arrow

`Assets/ATLAS/Shaders/NeonArrow.shader` uses URP additive blending, Fresnel glow, pulsing emission, double-sided rendering and no depth writes.

## Device build gate

The repository now contains reproducible scene/build automation, but AR is not marked device-verified until a physical iOS/Android build passes:
- camera permission;
- precise location permission;
- AR session tracking;
- Geospatial support check;
- Earth/VPS tracking where available;
- route fetch with authenticated ATLAS session;
- visible road-plane arrows;
- outdoor alignment measurement.

The manual GitHub workflow `ATLAS AR Drive Unity Device Build` can generate Android/iOS build artifacts once a Unity license secret is configured.
