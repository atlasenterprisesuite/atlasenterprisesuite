import { authorizeTrustedDataRoomRead, type TrustedDataRoomSources } from './secure-data-room-trusted-adapter';

const MAX_REQUEST_BYTES = 1024;
const PRIVATE_HEADERS = {
  'Cache-Control': 'no-store',
  'Pragma': 'no-cache',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
  'Vary': 'Authorization'
} as const;

/** Read a bounded request without trusting a forged Content-Length header. */
async function readJsonUnderLimit(request: Request): Promise<unknown | null> {
  const header = request.headers.get('content-length');
  if (header && (!/^\d+$/.test(header) || Number(header) > MAX_REQUEST_BYTES)) return null;
  if (!request.body) return null;
  const reader = request.body.getReader();
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      length += value.byteLength;
      if (length > MAX_REQUEST_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    const merged = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(merged));
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

/**
 * Authorization-only HTTP boundary. Does NOT deliver bytes, streams, storage
 * paths, or signed URLs. Real delivery requires a separate, auditable,
 * transactionally protected service and independent E2E certification.
 */
export function createDataRoomReadHandler(sources: TrustedDataRoomSources) {
  return async (request: Request): Promise<Response> => {
    const deny = (status: number, headers: Record<string, string> = {}) =>
      new Response(null, { status, headers: { ...PRIVATE_HEADERS, ...headers } });
    if (request.method !== 'POST') return deny(405, { Allow: 'POST' });
    const auth = request.headers.get('authorization') || '';
    const match = /^Bearer ([^\s]+)$/i.exec(auth);
    if (!match) return deny(403);
    const payload = await readJsonUnderLimit(request);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return deny(403);
    const entries = Object.entries(payload);
    if (entries.length !== 1 || entries[0][0] !== 'documentId') return deny(403);
    const id = entries[0][1];
    if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return deny(403);
    }
    const result = await authorizeTrustedDataRoomRead({ bearerToken: match[1], documentId: id }, sources);
    return new Response(null, { status: result.status, headers: PRIVATE_HEADERS });
  };
}
