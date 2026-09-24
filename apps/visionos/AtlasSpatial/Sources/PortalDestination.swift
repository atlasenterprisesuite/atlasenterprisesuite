import Foundation

struct AtlasPortalDestination: Codable, Equatable, Hashable, Sendable {
    let id: String
    let label: String
    let route: String
    let area: String

    var canonicalURL: URL? {
        guard route.hasPrefix("/"),
              !route.contains("://"),
              !route.contains("..") else {
            return nil
        }
        return URL(string: "https://www.atlasenterprisesuite.com\(route)")
    }
}

enum AtlasPortalRoutePolicy {
    static let allowedRoutes: Set<String> = [
        "/work",
        "/assistant",
        "/business",
        "/advisory",
        "/finance",
        "/crm",
        "/commerce",
        "/connect",
        "/payroll",
        "/learning",
        "/health",
        "/studio",
        "/voice",
        "/hospitality",
        "/ride",
        "/device-os",
        "/execution/manager/readiness"
    ]

    static func permits(_ destination: AtlasPortalDestination) -> Bool {
        allowedRoutes.contains(destination.route) && destination.canonicalURL != nil
    }
}

struct AtlasPortalBridgeEnvelope: Codable, Equatable, Sendable {
    let version: Int
    let intent: String
    let destination: AtlasPortalDestination
    let requestID: UUID

    enum CodingKeys: String, CodingKey {
        case version
        case intent
        case destination
        case requestID = "request_id"
    }

    var isSupported: Bool {
        version == 1
            && intent == "atlas.portal.open"
            && AtlasPortalRoutePolicy.permits(destination)
    }
}
