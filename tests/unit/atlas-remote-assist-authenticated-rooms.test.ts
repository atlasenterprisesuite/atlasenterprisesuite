import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sha256Sdp, validateRemoteAssistRoom } from '../../apps/web/src/modules/device-os/remoteAssistRoom.ts';

const id='11111111-1111-4111-8111-111111111111';
const sdp='v=0\r\na=fingerprint:sha-256 11:22:33:44\r\nm=video 9 UDP/TLS/RTP/SAVPF 96\r\n';

describe('ATLAS Remote Assist authenticated room',()=>{
  it('computes stable 64-hex fingerprints without emitting SDP', async ()=>{
    const value=await sha256Sdp(sdp);
    expect(value).toMatch(/^[a-f0-9]{64}$/);
    expect(value).toBe(await sha256Sdp(sdp));
    expect(value).not.toContain('fingerprint');
  });
  it('rejects cross-tenant, wrong actor, expired and revoked session states',()=>{
    const room={id,org_id:'org-a',host_user_id:'host-a',viewer_user_id:'viewer-b',status:'approved',expires_at:'2026-10-13T20:00:00Z'};
    expect(validateRemoteAssistRoom(room,{orgId:'org-a',userId:'host-a',role:'host',now:'2026-10-13T19:00:00Z'})).toEqual(room);
    expect(()=>validateRemoteAssistRoom(room,{orgId:'org-b',userId:'host-a',role:'host',now:'2026-10-13T19:00:00Z'})).toThrow('room_scope_denied');
    expect(()=>validateRemoteAssistRoom(room,{orgId:'org-a',userId:'host-a',role:'viewer',now:'2026-10-13T19:00:00Z'})).toThrow('room_actor_denied');
    expect(()=>validateRemoteAssistRoom({...room,status:'revoked'},{orgId:'org-a',userId:'host-a',role:'host',now:'2026-10-13T19:00:00Z'})).toThrow('room_revoked');
    expect(()=>validateRemoteAssistRoom(room,{orgId:'org-a',userId:'host-a',role:'host',now:'2026-10-13T21:00:00Z'})).toThrow('room_expired');
  });
  it('requires active org membership plus view-only state transitions in the transaction',()=>{
    const sql=readFileSync('supabase/migrations/20261013181500_atlas_remote_assist_authenticated_rooms.sql','utf8');
    expect(sql).toContain('atlas_remote_assist_sessions');
    expect(sql).toContain('enable row level security');
    expect(sql).toContain('revoke all on table public.atlas_remote_assist_sessions from public, anon, authenticated');
    expect(sql).toContain("om.status = 'active'");
    expect(sql).toContain("om.role in ('owner', 'admin', 'platform_admin')");
    expect(sql).toContain("v_session.host_user_id = p_actor_id");
    expect(sql).toContain("v_session.offer_sha256 = p_digest");
    expect(sql).toContain("v_session.answer_sha256 = p_digest");
    expect(sql).toContain("from public, anon, authenticated");
    expect(sql).toContain('grant execute on function public.atlas_remote_assist_event');
    expect(sql).toContain('to service_role');
    expect(sql).toContain('insert into public.audit_logs');
    expect(sql).not.toMatch(/password|create\s+policy\s+remote_assist_public/i);
  });
  it('edge API checks JWT and organization membership before invoking service RPC',()=>{
    const edge=readFileSync('supabase/functions/atlas-remote-assist/index.ts','utf8');
    expect(edge).toContain('sb.auth.getUser(token)');
    expect(edge).toContain(".eq('status', 'active')");
    expect(edge).toContain("['owner', 'admin', 'platform_admin']");
    expect(edge).toContain("adminClient().rpc('atlas_remote_assist_event'");
    expect(edge).toContain('request_too_large');
    expect(edge).not.toContain('console.log');
  });
  it('UI does not enable peer viewing until authorized and approved by host',()=>{
    const component=readFileSync('apps/web/src/modules/device-os/BrowserScreenAssist.tsx','utf8');
    expect(component).toContain("remoteAssistRoom('join'");
    expect(component).toContain("remoteAssistRoom('approve'");
    expect(component).toContain("remoteAssistRoom('answer'");
    expect(component).toContain("remoteAssistRoom('activate'");
    expect(component).toContain("remoteAssistRoom('status'");
    expect(component).toContain("remoteAssistRoom('stop'");
    expect(component).toContain('verifiedViewerId');
    expect(component).toContain('statusPoll');
    expect(component).toContain('getDisplayMedia');
  });
});
