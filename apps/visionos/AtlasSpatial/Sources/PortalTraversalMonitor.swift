import ARKit
import Foundation
import QuartzCore
import simd

actor PortalTraversalMonitor {
    private let session = ARKitSession()
    private let worldTracking = WorldTrackingProvider()
    private var running = false

    func run(
        portalCenter: SIMD3<Float>,
        halfWidth: Float,
        halfHeight: Float,
        onTraverse: @escaping @Sendable () async -> Void
    ) async throws {
        guard WorldTrackingProvider.isSupported else {
            throw PortalTraversalError.worldTrackingUnavailable
        }

        running = true
        try await session.run([worldTracking])

        var previousSide: Float?

        while running && !Task.isCancelled {
            if let anchor = worldTracking.queryDeviceAnchor(
                atTimestamp: CACurrentMediaTime()
            ), anchor.isTracked {
                let transform = anchor.originFromAnchorTransform
                let position = SIMD3<Float>(
                    transform.columns.3.x,
                    transform.columns.3.y,
                    transform.columns.3.z
                )

                let side = position.z - portalCenter.z
                let withinPortal =
                    abs(position.x - portalCenter.x) <= halfWidth
                    && abs(position.y - portalCenter.y) <= halfHeight

                if let previous = previousSide,
                   previous > 0.10,
                   side <= 0.10,
                   withinPortal {
                    running = false
                    await onTraverse()
                    return
                }

                previousSide = side
            }

            try await Task.sleep(for: .milliseconds(45))
        }
    }

    func stop() {
        running = false
    }

    enum PortalTraversalError: Error {
        case worldTrackingUnavailable
    }
}
