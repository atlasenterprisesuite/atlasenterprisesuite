import Combine
import Foundation

@MainActor
final class AtlasSpatialModel: ObservableObject {
    static let immersiveSpaceID = "AtlasPortalSpace"

    enum RuntimeState: Equatable {
        case idle
        case opening
        case immersive
        case traversing
        case denied(String)
        case failed(String)
    }

    @Published private(set) var selectedDestination: AtlasPortalDestination?
    @Published private(set) var runtimeState: RuntimeState = .idle
    @Published private(set) var pendingNavigationRoute: String?
    @Published private(set) var lastRequestID: UUID?

    func acceptBridgeEnvelope(_ envelope: AtlasPortalBridgeEnvelope) {
        guard envelope.isSupported else {
            runtimeState = .denied("Bridge payload failed the native route policy.")
            return
        }

        guard lastRequestID != envelope.requestID else { return }
        lastRequestID = envelope.requestID
        selectedDestination = envelope.destination
        runtimeState = .opening
    }

    func immersiveOpened() {
        runtimeState = .immersive
    }

    func immersiveOpenFailed(_ reason: String) {
        runtimeState = .failed(reason)
    }

    func traverseSelectedPortal() {
        guard let destination = selectedDestination,
              AtlasPortalRoutePolicy.permits(destination) else {
            runtimeState = .denied("No authorized portal destination is selected.")
            return
        }

        runtimeState = .traversing
        pendingNavigationRoute = destination.route
    }

    func consumeNavigationRoute(_ route: String) {
        guard pendingNavigationRoute == route else { return }
        pendingNavigationRoute = nil
        runtimeState = .idle
    }

    func resetImmersiveState() {
        if case .traversing = runtimeState { return }
        runtimeState = .idle
    }
}
