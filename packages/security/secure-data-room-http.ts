import { authorizeTrustedDataRoomRead, type TrustedDataRoomSources } from './secure-data-room-trusted-adapter';

/**
 * Read-only HTTP boundary. This does not return document bytes or signed URLs.
 * Trusted sources must resolve authorization server-side for every request.
 */
export function createDataRoomReadHandler(sources: TrustedDataRoomSources) {
  return async (request: Request): Promise<Response> => {
    const deny = (status: number, headers: Record<string, string> = {}) =>
      new Response(null, { status, headers: { ...headers, 'Cache-Control': 'no-store' } });
    if (request.method !== 'POST') return deny(405, { Allow: 'POST' });
    const auth = request.headers.get('authorization') || '';
    const match = /^Bearer ([^\s]+)$/i.exec(auth);
    if (!match) return deny(403);
    let payload: unknown;
    try { payload = await request.json(); } catch { return deny(403); }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return deny(403);
    const id = (payload as Record<string, unknown>).documentId;
    if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
      return deny(403);
    }
    const result = await authorizeTrustedDataRoomRead({ bearerToken: match[1], documentId: id }, sources);
    return new Response(null, { status: result.status, headers: { 'Cache-Control': 'no-store' } });
  };
}
