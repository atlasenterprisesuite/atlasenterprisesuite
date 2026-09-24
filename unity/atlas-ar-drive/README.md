# ATLAS AR Drive — Unity Prototype

This project is the cross-platform AR rendering layer for ATLAS GPS 4D.

## Baseline

- Unity 6.3 LTS (6000.3.0f1)
- AR Foundation 6.3.1
- ARCore XR Plugin 6.3.1
- ARKit XR Plugin 6.3.1
- Google ARCore Extensions for AR Foundation via the official #arf6 branch
- URP
- Input System

## Architecture

ATLAS Navigation Engine / ATLAS GPS API
→ authenticated route response
→ waypoints[{lat,lon}]
→ Unity AR Drive
→ ARCore/ARKit tracking
→ Geospatial anchors when available
→ local-meter fallback otherwise
→ neon route arrows
→ lower route mini-map

The Unity project does not contain provider secrets. The host app injects the ATLAS GPS Edge Function endpoint, active organization id, and short-lived user access token.

## Scene wiring

Create a scene with AR Session, XR Origin (AR) + AR Camera, ARCore Extensions, AREarthManager, ARAnchorManager, AtlasRouteClient, AtlasGeospatialRouteRenderer, AtlasLocalRouteRenderer, AtlasMiniMapRouteRenderer, AtlasArDriveController, and two cameras wired into AtlasSplitScreenLayout.

Top camera: AR camera feed and 3D arrows.
Bottom camera: mini-map / map adapter.

## Neon arrow

Assets/ATLAS/Shaders/NeonArrow.shader is an additive URP shader with HDR-friendly color/intensity, Fresnel edge glow, time-based pulse, transparent additive blend, and disabled depth writes.

Assign the shader to the arrow material and use the material on a low-poly arrow mesh.

## Geospatial

Enable ARCore Geospatial in the ARCore Extensions config. Check VPS availability before entering Geospatial AR. Prefer keyless authorization where available; do not commit API keys.

The renderer only creates route anchors when Earth tracking is active. If Geospatial tracking is unavailable, ATLAS falls back to local meter projection from the current origin.

## Routing

Unity does not call Mapbox or Google Routes directly. It calls the authenticated ATLAS GPS backend. The backend may later change routing providers without changing the mobile client contract.

This keeps provider tokens server-side, tenant/RBAC boundaries intact, routing providers replaceable, and paid fallback disabled unless explicitly authorized.

## Current limit

This is an MVT architecture and code scaffold. It still requires opening in Unity, creating the AR scene/prefabs/material assets, enabling platform XR providers, and device testing. ARCore Geospatial availability varies by device and location.
