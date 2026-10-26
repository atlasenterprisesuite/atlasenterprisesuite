// swift-tools-version: 5.9
import PackageDescription
let package = Package(name: "AtlasLiveScreenBridge", platforms: [.iOS(.v16)], products: [.library(name: "AtlasLiveScreenBridge", targets: ["AtlasLiveScreenBridge"])], targets: [.target(name: "AtlasLiveScreenBridge"), .testTarget(name: "AtlasLiveScreenBridgeTests", dependencies: ["AtlasLiveScreenBridge"])])
