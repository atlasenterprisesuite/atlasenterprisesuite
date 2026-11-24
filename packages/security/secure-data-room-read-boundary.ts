import { authorizeDocumentRead, type DataRoomReadContext } from './secure-data-room-policy';

/**
 * HTTP-independent read boundary. The resolver is a trusted server-side
 * dependency that must query authoritative identity, membership, grant and
 * revocation state on every request. Never implement it with client flags.
 */
export type DataRoomReadResolver = (request: Readonly<{
  bearerToken: string;
  documentId: string;
}>) => Promise<DataRoomReadContext | null>;

export type DataRoomReadResult =
  | { status: 200; allowed: true }
  | { status: 403; allowed: false };

export async function resolveDataRoomRead(
  request: Readonly<{ bearerToken?: string | null; documentId?: string | null }>,
  resolver: DataRoomReadResolver
): Promise<DataRoomReadResult> {
  if (!request.bearerToken?.trim() || !request.documentId?.trim()) {
    return { status: 403, allowed: false };
  }
  try {
    const context = await resolver({
      bearerToken: request.bearerToken,
      documentId: request.documentId
    });
    return authorizeDocumentRead(context)
      ? { status: 200, allowed: true }
      : { status: 403, allowed: false };
  } catch {
    return { status: 403, allowed: false };
  }
}
