// swift-tools-version: 5.10
import PackageDescription

let package = Package(
    name: "AtlasAppleVoiceBridge",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "AtlasAppleVoiceBridge", targets: ["AtlasAppleVoiceBridge"])
    ],
    targets: [
        .target(name: "AtlasAppleVoiceBridge"),
        .testTarget(name: "AtlasAppleVoiceBridgeTests", dependencies: ["AtlasAppleVoiceBridge"])
    ]
)
