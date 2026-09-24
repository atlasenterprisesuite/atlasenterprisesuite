import SwiftUI

struct AtlasPortalHostView: View {
    @ObservedObject var model: AtlasSpatialModel
    @Environment(\.openImmersiveSpace) private var openImmersiveSpace
    @Environment(\.dismissImmersiveSpace) private var dismissImmersiveSpace

    var body: some View {
        ZStack(alignment: .bottom) {
            AtlasPortalWebView(model: model)

            runtimeStatus
                .padding(24)
        }
        .onChange(of: model.runtimeState) { _, state in
            guard case .opening = state else { return }

            Task {
                let result = await openImmersiveSpace(id: AtlasSpatialModel.immersiveSpaceID)
                switch result {
                case .opened:
                    model.immersiveOpened()
                case .userCancelled:
                    model.immersiveOpenFailed("Immersive space opening was cancelled.")
                case .error:
                    model.immersiveOpenFailed("visionOS could not open the immersive space.")
                @unknown default:
                    model.immersiveOpenFailed("Unknown immersive-space result.")
                }
            }
        }
        .onChange(of: model.pendingNavigationRoute) { _, route in
            guard route != nil else { return }
            Task {
                await dismissImmersiveSpace()
            }
        }
    }

    private var runtimeStatus: some View {
        HStack(spacing: 12) {
            Image(systemName: "visionpro")
            VStack(alignment: .leading, spacing: 3) {
                Text("ATLAS Spatial")
                    .font(.headline)
                Text(statusText)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .glassBackgroundEffect()
    }

    private var statusText: String {
        switch model.runtimeState {
        case .idle:
            "Native portal bridge ready"
        case .opening:
            "Opening immersive portal"
        case .immersive:
            "Spatial portal active"
        case .traversing:
            "Traversing portal"
        case .denied(let reason), .failed(let reason):
            reason
        }
    }
}
