# ATLAS Portals — Immersive XR and Native Spatial Boundary

Date: 2026-09-18  
Repository: `atlasenterprisesuite/atlasenterprisesuite`

## Runtime contract

ATLAS Portals progressively enhances from browser 3D to spatial runtimes without fabricating device support.

1. Browser 3D remains universally available.
2. On HTTPS, ATLAS checks `navigator.xr.isSessionSupported('immersive-ar')`.
3. If immersive AR is available, the user may explicitly start an `immersive-ar` session.
4. If AR is unavailable but `immersive-vr` is available, ATLAS offers an immersive spatial preview and labels it as VR/non-passthrough.
5. If a native host injects the ATLAS spatial bridge, ATLAS can hand the selected registered route to that native host.
6. The native host must independently enforce identity, tenant, RBAC and route authorization.

## WebXR implementation

The web runtime:

- requires secure context;
- requires a user gesture before requesting an immersive session;
- requests `local` and prefers `local-floor` reference space;
- renders a real WebGL portal ring through `XRWebGLLayer`;
- tracks the viewer pose through WebXR frames;
- detects a forward crossing of the portal plane within the portal bounds;
- ends the XR session before navigating to the canonical ATLAS route;
- never invents camera passthrough or device features.

The Cloudflare Worker allows only `xr-spatial-tracking=(self)` in Permissions Policy. Existing camera, geolocation, payment and USB restrictions remain denied.

## Apple Vision Pro / visionOS

As of September 2026, Apple publicly describes Safari WebXR on Vision Pro as supporting immersive WebXR while developers continue to request `immersive-ar` passthrough support. Therefore ATLAS must not label Safari on Vision Pro as AR unless `isSessionSupported('immersive-ar')` actually returns true at runtime.

True passthrough AR on current Vision Pro deployments should use a native visionOS application based on SwiftUI/RealityKit/ARKit capabilities exposed by Apple.

ATLAS prepares that boundary through a bridge named:

`webkit.messageHandlers.atlasSpatialPortals`

A native host may inject that bridge into a governed web view. ATLAS sends only:

- contract version;
- intent `atlas.portal.open`;
- registered destination id;
- label;
- canonical route;
- ATLAS area;
- request id.

The bridge is not authentication. The native host must re-resolve authorization and must not trust route access simply because the web UI sent a destination.

## Future native implementation

The native visionOS adapter should:

1. receive the bridge payload;
2. validate active ATLAS identity and tenant;
3. confirm destination authorization through the same governed backend;
4. create an immersive space;
5. use RealityKit/ARKit spatial tracking and anchoring;
6. render the portal in the physical environment;
7. detect crossing or explicit gaze/pinch activation;
8. transition into the corresponding ATLAS module surface;
9. audit the spatial navigation event;
10. fail closed if identity, network or authorization cannot be verified.

No native adapter is marked live until a signed visionOS build has passed device testing.
