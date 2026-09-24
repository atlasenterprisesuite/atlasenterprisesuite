import type { PortalDestination } from './portalModel';

type WebKitMessageHandler = {
  postMessage(message: unknown): void;
};

type NativeSpatialWindow = Window & {
  webkit?: {
    messageHandlers?: {
      atlasSpatialPortals?: WebKitMessageHandler;
    };
  };
  AtlasSpatialBridge?: {
    openPortal(message: unknown): void;
  };
};

export type NativeSpatialBridgeKind = 'visionos-webkit' | 'generic-native' | null;

export function detectNativeSpatialBridge(
  source: Partial<NativeSpatialWindow> = window as NativeSpatialWindow
): NativeSpatialBridgeKind {
  if (source.webkit?.messageHandlers?.atlasSpatialPortals?.postMessage) {
    return 'visionos-webkit';
  }
  if (source.AtlasSpatialBridge?.openPortal) {
    return 'generic-native';
  }
  return null;
}

export function requestNativeSpatialPortal(destination: PortalDestination): NativeSpatialBridgeKind {
  const source = window as NativeSpatialWindow;
  const kind = detectNativeSpatialBridge(source);
  const payload = {
    version: 1,
    intent: 'atlas.portal.open',
    destination: {
      id: destination.id,
      label: destination.label,
      route: destination.route,
      area: destination.area
    },
    request_id: crypto.randomUUID()
  };

  if (kind === 'visionos-webkit') {
    source.webkit!.messageHandlers!.atlasSpatialPortals!.postMessage(payload);
    return kind;
  }

  if (kind === 'generic-native') {
    source.AtlasSpatialBridge!.openPortal(payload);
    return kind;
  }

  return null;
}
