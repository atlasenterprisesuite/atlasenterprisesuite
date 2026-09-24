import Foundation
import WebKit

@MainActor
final class AtlasPortalBridgeHandler: NSObject, WKScriptMessageHandler {
    static let handlerName = "atlasSpatialPortals"

    private weak var model: AtlasSpatialModel?

    init(model: AtlasSpatialModel) {
        self.model = model
        super.init()
    }

    func userContentController(
        _ userContentController: WKUserContentController,
        didReceive message: WKScriptMessage
    ) {
        guard message.name == Self.handlerName else { return }

        do {
            let data = try JSONSerialization.data(
                withJSONObject: message.body,
                options: [.fragmentsAllowed]
            )
            let envelope = try JSONDecoder().decode(
                AtlasPortalBridgeEnvelope.self,
                from: data
            )
            model?.acceptBridgeEnvelope(envelope)
        } catch {
            model?.immersiveOpenFailed("Invalid ATLAS spatial bridge message.")
        }
    }
}
