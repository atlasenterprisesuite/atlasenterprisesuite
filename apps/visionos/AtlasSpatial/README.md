# ATLAS Spatial for visionOS

Native visionOS host for ATLAS Portals.

## Architecture

- SwiftUI window hosts the canonical ATLAS /galaxy/portals surface in WKWebView.
- WKScriptMessageHandler receives the existing atlasSpatialPortals bridge contract.
- Native route policy validates every requested destination against a fail-closed canonical allowlist.
- ImmersiveSpace + RealityView render the native portal.
- WorldTrackingProvider monitors Apple Vision Pro device pose.
- Walking through the portal plane or using gaze + pinch triggers the selected canonical ATLAS route.
- The immersive space closes before the web shell navigates.
- Web authentication cookies remain in the standard persistent WKWebsiteDataStore; the bridge itself is never treated as authentication.

## Generate the Xcode project

Install XcodeGen on a Mac with Apple silicon, then run:

    cd apps/visionos/AtlasSpatial
    xcodegen generate
    open AtlasSpatial.xcodeproj

## Signing

Signing credentials are not committed.

Set the Apple Development Team in Xcode or provide it only through an authorized CI signing environment. Do not add certificates, private keys, provisioning profiles, App Store Connect API keys, or signing passwords to source control.

Expected bundle identifier:

    com.atlasenterprisesuite.spatial

## Verification states

- source-ready: source contract and repository tests pass.
- simulator-verified: target builds and launches on a compatible visionOS Simulator.
- signed-build-verified: signed archive succeeds with authorized Apple credentials.
- device-verified: portal rendering, world tracking, bridge handoff and traversal pass on physical Apple Vision Pro.
- live: only after device-verified and an approved distribution channel exist.

The repository must remain at device-verification-required until the physical-device gate passes.
