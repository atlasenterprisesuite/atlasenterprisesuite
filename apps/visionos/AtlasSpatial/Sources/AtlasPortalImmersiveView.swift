import RealityKit
import SwiftUI

struct AtlasPortalImmersiveView: View {
    @ObservedObject var model: AtlasSpatialModel
    @Environment(\.dismissImmersiveSpace) private var dismissImmersiveSpace
    @State private var monitorTask: Task<Void, Never>?

    private let portalCenter = SIMD3<Float>(0, 1.25, -1.8)

    var body: some View {
        RealityView { content in
            let root = Entity()
            root.name = "ATLAS_PORTAL_ROOT"

            let ringMesh = MeshResource.generateSphere(radius: 0.055)
            let ringMaterial = UnlitMaterial(color: .cyan)

            for index in 0..<56 {
                let angle = Float(index) / 56 * .pi * 2
                let segment = ModelEntity(
                    mesh: ringMesh,
                    materials: [ringMaterial]
                )
                segment.position = [
                    cos(angle) * 0.72,
                    portalCenter.y + sin(angle) * 1.05,
                    portalCenter.z
                ]
                root.addChild(segment)
            }

            let target = ModelEntity(
                mesh: .generateBox(size: [1.35, 2.0, 0.03], cornerRadius: 0.02),
                materials: [UnlitMaterial(color: .clear)]
            )
            target.name = "ATLAS_PORTAL_TARGET"
            target.position = portalCenter
            target.components.set(InputTargetComponent())
            target.generateCollisionShapes(recursive: false)
            root.addChild(target)

            content.add(root)
        }
        .gesture(
            SpatialTapGesture()
                .targetedToAnyEntity()
                .onEnded { value in
                    guard value.entity.name == "ATLAS_PORTAL_TARGET" else { return }
                    traverse()
                }
        )
        .task {
            let monitor = PortalTraversalMonitor()
            monitorTask = Task {
                do {
                    try await monitor.run(
                        portalCenter: portalCenter,
                        halfWidth: 0.68,
                        halfHeight: 1.0
                    ) {
                        await MainActor.run {
                            traverse()
                        }
                    }
                } catch {
                    // Gaze + pinch remains an intentional fallback if world tracking is unavailable.
                }
            }
        }
        .onDisappear {
            monitorTask?.cancel()
            monitorTask = nil
            model.resetImmersiveState()
        }
    }

    @MainActor
    private func traverse() {
        model.traverseSelectedPortal()
        Task {
            await dismissImmersiveSpace()
        }
    }
}
