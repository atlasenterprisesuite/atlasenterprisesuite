# ATLAS AR Drive — Unity MVT

Date: 2026-09-24

## Decision

Use Unity for the cross-platform AR rendering layer while keeping ATLAS Identity, routing, navigation state and provider governance outside the Unity scene.

Validated stack:
- Unity 6.3 LTS
- AR Foundation 6.x
- ARCore / ARKit XR plugins
- ARCore Extensions for AR Foundation #arf6
- URP

Mapbox Maps SDK for Unity v2 is intentionally not adopted because Mapbox documents that v2 is not in active development and v3 is still in development.

## Runtime flow

ATLAS authenticated session
→ ATLAS GPS Edge Function
→ route waypoints
→ Unity route resampling
→ ARCore Geospatial anchors when Earth tracking is available
→ local-meter fallback otherwise
→ neon 3D route arrows
→ lower mini-map route
→ navigation HUD

## Security

No Google/Mapbox/provider API secret is committed into Unity.

ATLAS injects:
- GPS endpoint
- organization id
- short-lived access token

The Unity client uses the existing tenant-aware ATLAS boundary.

## Rendering

The route arrow shader uses URP, additive blending, Fresnel edge emphasis, pulsing emission, transparent behavior, and no depth writes.

## Geospatial behavior

The first MVT creates route points only within a bounded forward distance and resamples the route at a fixed spacing. It does not create one anchor for every raw route coordinate.

When VPS/Earth tracking is unavailable, local-meter projection keeps the prototype operational but must not be described as VPS-verified alignment.

## Map layer

The first Unity MVT provides a route mini-map. A production street basemap remains a separate provider-neutral adapter. No obsolete Mapbox Unity SDK is introduced.

## Production gate

This phase is source-level infrastructure. It is not production-verified AR until:
- Unity project imports cleanly
- iOS and Android device builds pass
- ARCore/ARKit permissions pass
- Geospatial/VPS behavior is tested on-device
- route overlay alignment is measured outdoors
