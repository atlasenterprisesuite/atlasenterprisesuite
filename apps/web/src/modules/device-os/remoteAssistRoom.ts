import { authorizedAtlasFetch, getActiveAtlasOrganization } from '../../lib/atlasSession';

export type RoomAction = 'create'|'join'|'approve'|'answer'|'activate'|'status'|'stop';
export type RoomRole = 'host'|'viewer';
export type RemoteAssistRoom = {
  id: string;
  org_id: string;
  host_user_id: string;
  viewer_user_id: string | null;
  status: 'invited'|'joined'|'approved'|'answer_ready'|'active'|'revoked';
  offer_sha256: string;
  answer_sha256: string | null;
  expires_at: string;
};
type SignedRoomResponse = { ok: boolean; room?: RemoteAssistRoom; actor_id?: string; role?: RoomRole; error?: string };

export async function sha256Sdp(value: string): Promise<string> {
  if (typeof value !== 'string' || !value.startsWith('v=0') || value.length > 75000) {
    throw new Error('invalid_sdp');
  }
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2,'0')).join('');
}

export function validateRemoteAssistRoom(
  room: RemoteAssistRoom,
  context: {orgId: string; userId: string; role: RoomRole; now?: string}
): RemoteAssistRoom {
  if (!room || room.org_id !== context.orgId) throw new Error('room_scope_denied');
  const actor = context.role === 'host' ? room.host_user_id : room.viewer_user_id;
  if (!actor || actor !== context.userId) throw new Error('room_actor_denied');
  if (room.status === 'revoked') throw new Error('room_revoked');
  if (!Number.isFinite(Date.parse(room.expires_at)) ||
      Date.parse(room.expires_at) <= Date.parse(context.now || new Date().toISOString())) {
    throw new Error('room_expired');
  }
  return room;
}

export async function remoteAssistRoom(action: RoomAction, sessionId: string, digest?: string): Promise<RemoteAssistRoom> {
  const org = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch('/functions/v1/atlas-remote-assist', {
    method: 'POST',
    body: JSON.stringify({
      action,
      organization_id: org.id,
      session_id: sessionId,
      ...(digest ? { digest } : {})
    })
  });
  const body = await response.json().catch(() => null) as SignedRoomResponse | null;
  if (!response.ok || !body?.ok || !body.room) {
    throw new Error(body?.error || 'remote_assist_room_unavailable');
  }
  if (!body.actor_id || (body.role !== 'host' && body.role !== 'viewer')) {
    throw new Error('room_identity_unverified');
  }
  if (action === 'stop') {
    if (body.room.status !== 'revoked' || body.room.org_id !== org.id) {
      throw new Error('room_revoke_unverified');
    }
    return body.room;
  }
  return validateRemoteAssistRoom(body.room, {
    orgId: org.id, userId: body.actor_id, role: body.role
  });
}
