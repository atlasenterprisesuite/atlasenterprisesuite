// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "AtlasAppleNavigationBridge",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "AtlasAppleNavigationBridge", targets: ["AtlasAppleNavigationBridge"])
    ],
    targets: [
        .target(name: "AtlasAppleNavigationBridge"),
        .testTarget(name: "AtlasAppleNavigationBridgeTests", dependencies: ["AtlasAppleNavigationBridge"])
    ]
)
