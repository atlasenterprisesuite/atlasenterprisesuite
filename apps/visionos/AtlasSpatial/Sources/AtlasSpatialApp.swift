import SwiftUI

@main
struct AtlasSpatialApp: App {
    @StateObject private var model = AtlasSpatialModel()

    var body: some Scene {
        WindowGroup {
            AtlasPortalHostView(model: model)
        }
        .windowStyle(.plain)

        ImmersiveSpace(id: AtlasSpatialModel.immersiveSpaceID) {
            AtlasPortalImmersiveView(model: model)
        }
        .immersionStyle(selection: .constant(.mixed), in: .mixed)
    }
}
