import type { ReconnectExtensionMessage, ReconnectExtensionResponse } from './core/messages';
import { fillReconnectRecord, detectReconnectPage } from './reconnect/adapter';
import { clearReviewOverlay, renderReviewOverlay } from './reconnect/review-overlay';

export function handleReconnectMessage(
  document: Document,
  location: URL,
  message: ReconnectExtensionMessage
): ReconnectExtensionResponse {
  if (message.type === 'ATLAS_RECONNECT_CLEAR_REVIEW') {
    clearReviewOverlay(document);
    return { ok: true, status: 'cleared' };
  }

  if (message.type === 'ATLAS_RECONNECT_STATUS') {
    const detection = detectReconnectPage(document, location);
    if (detection.supported) return { ok: true, status: 'ready', detail: detection };
    return { ok: false, status: 'blocked', reason: detection.kind, detail: detection };
  }

  const records = message.type === 'ATLAS_RECONNECT_FILL_CURRENT' ? [message.record] : message.records;
  if (!records.length) {
    renderReviewOverlay(document, { state: 'blocked', reason: 'no_verified_records' });
    return { ok: false, status: 'blocked', reason: 'no_verified_records' };
  }

  // Reconnect commonly presents one contact-entry form at a time. Fill one verified
  // record on the current form and leave navigation/save/next to the user.
  const result = fillReconnectRecord(document, records[0], { origin: location.origin });
  if (result.status === 'blocked') {
    renderReviewOverlay(document, { state: 'blocked', reason: result.reason });
    return { ok: false, status: 'blocked', reason: result.reason };
  }

  renderReviewOverlay(document, {
    state: 'filled',
    filled: result.filled,
    preserved: result.preserved,
    reason: records.length > 1 ? `${records.length - 1} verified record(s) remain for another Add Work Search form` : undefined
  });
  return {
    ok: true,
    status: 'filled',
    detail: { filled: result.filled, preserved: result.preserved, remaining: Math.max(0, records.length - 1) }
  };
}

type RuntimeListener = (
  message: ReconnectExtensionMessage,
  sender: unknown,
  sendResponse: (response: ReconnectExtensionResponse) => void
) => boolean | void;

type ChromeRuntime = { onMessage?: { addListener(listener: RuntimeListener): void } };
const chromeRuntime = (globalThis as unknown as { chrome?: { runtime?: ChromeRuntime } }).chrome?.runtime;

if (chromeRuntime?.onMessage) {
  chromeRuntime.onMessage.addListener((message, _sender, sendResponse) => {
    sendResponse(handleReconnectMessage(document, new URL(globalThis.location.href), message));
    return false;
  });
}
