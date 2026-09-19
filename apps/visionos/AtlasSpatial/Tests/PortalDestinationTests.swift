import XCTest
@testable import AtlasSpatial

final class PortalDestinationTests: XCTestCase {
    func testAllowsCanonicalRegisteredDestination() {
        let destination = AtlasPortalDestination(
            id: "finance",
            label: "Finance",
            route: "/finance",
            area: "Finance"
        )
        XCTAssertTrue(AtlasPortalRoutePolicy.permits(destination))
    }

    func testRejectsArbitraryRoute() {
        let destination = AtlasPortalDestination(
            id: "unknown",
            label: "Unknown",
            route: "/admin/secrets",
            area: "Platform"
        )
        XCTAssertFalse(AtlasPortalRoutePolicy.permits(destination))
    }

    func testRejectsAbsoluteExternalURL() {
        let destination = AtlasPortalDestination(
            id: "external",
            label: "External",
            route: "https://example.com",
            area: "External"
        )
        XCTAssertFalse(AtlasPortalRoutePolicy.permits(destination))
    }

    func testBridgeRequiresKnownContractVersionAndIntent() {
        let destination = AtlasPortalDestination(
            id: "health",
            label: "Health",
            route: "/health",
            area: "Health"
        )
        let valid = AtlasPortalBridgeEnvelope(
            version: 1,
            intent: "atlas.portal.open",
            destination: destination,
            requestID: UUID()
        )
        let invalid = AtlasPortalBridgeEnvelope(
            version: 2,
            intent: "atlas.portal.open",
            destination: destination,
            requestID: UUID()
        )
        XCTAssertTrue(valid.isSupported)
        XCTAssertFalse(invalid.isSupported)
    }
}
