import SwiftUI
import WebKit

struct AtlasPortalWebView: UIViewRepresentable {
    @ObservedObject var model: AtlasSpatialModel

    final class Coordinator {
        let bridgeHandler: AtlasPortalBridgeHandler
        var lastNavigationRoute: String?

        init(model: AtlasSpatialModel) {
            bridgeHandler = AtlasPortalBridgeHandler(model: model)
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(model: model)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.userContentController.add(
            context.coordinator.bridgeHandler,
            name: AtlasPortalBridgeHandler.handlerName
        )

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.allowsBackForwardNavigationGestures = true

        if let url = URL(string: "https://www.atlasenterprisesuite.com/galaxy/portals") {
            webView.load(URLRequest(url: url))
        }

        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        guard let route = model.pendingNavigationRoute,
              route != context.coordinator.lastNavigationRoute,
              AtlasPortalRoutePolicy.allowedRoutes.contains(route),
              let url = URL(string: "https://www.atlasenterprisesuite.com\(route)") else {
            return
        }

        context.coordinator.lastNavigationRoute = route
        webView.load(URLRequest(url: url))

        Task { @MainActor in
            model.consumeNavigationRoute(route)
        }
    }

    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        webView.configuration.userContentController.removeScriptMessageHandler(
            forName: AtlasPortalBridgeHandler.handlerName
        )
    }
}
