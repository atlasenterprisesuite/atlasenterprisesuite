import { describe, expect, it, vi } from 'vitest';
import { authorizeAgentSpeech, executeAgentSpeech, type AgentSpeechRequest } from '../../packages/voice/src/agentSpeech';

function fixture(): AgentSpeechRequest {
  const capabilities = {localPlayback:true,audioExport:true,realtimeStream:false,telephony:false,serverSynthesis:true};
  return {
    actorId:'agent-1',
    actor:{scope:{tenantId:'tenant-a',organizationId:'org-a'},permissions:['voice.personal.use']},
    profile:{id:'voice-1',ownerActorId:'owner-1',tenantId:'tenant-a',organizationId:'org-a',name:'Synthetic',language:'es',providerKind:'atlas',status:'ready',capabilities,createdAt:'2026-10-01T00:00:00Z'},
    consent:{profileId:'voice-1',ownerActorId:'owner-1',version:'1',acceptedAt:'2026-11-01T00:00:00Z',revokedAt:null,permittedPurposes:['narration_export'],permittedConsumers:['atlas-agent']},
    grant:{profileId:'voice-1',ownerActorId:'owner-1',granteeActorId:'agent-1',consumerId:'atlas-agent',permittedPurposes:['narration_export'],permittedLocales:['es-ES'],permittedStyles:['documentary'],expiresAt:'2027-01-01T00:00:00Z',revokedAt:null},
    binding:{profileId:'voice-1',backend:'atlas_local',privateVoiceRef:'private:voice-1',status:'ready',capabilities,verifiedLocales:['es-ES'],verifiedStyles:['documentary']},
    consumerId:'atlas-agent',purpose:'narration_export',locale:'es-ES',style:'documentary',text:'Prueba de voz sintética.',
    now:'2026-11-26T12:00:00Z',allowExternalProvider:false
  };
}
const denies = (request: AgentSpeechRequest, reason: string) =>
  expect(authorizeAgentSpeech(request)).toEqual({allowed:false,reason});

describe('ATLAS 777 Voice Agent governance', () => {
  it('allows a verified, owner-consented ATLAS local narrator',()=>{
    expect(authorizeAgentSpeech(fixture())).toEqual({allowed:true,backend:'atlas_local',capability:'audioExport'});
  });
  it('isolates tenants, organizations and role permissions',()=>{
    const a=fixture();a.actor.scope.tenantId='another';denies(a,'scope_mismatch');
    const b=fixture();b.actor.scope.organizationId='another';denies(b,'scope_mismatch');
    const c=fixture();c.actor.permissions=['agents.admin'];denies(c,'permission_denied');
  });
  it('blocks missing, revoked and mismatched consent',()=>{
    const a=fixture();a.consent=null;denies(a,'consent_required');
    const b=fixture();b.consent!.revokedAt=b.now;denies(b,'consent_revoked');
    const c=fixture();c.consent!.ownerActorId='other';denies(c,'owner_mismatch');
  });
  it('requires an explicit agent grant, even for the owner',()=>{
    const a=fixture();a.grant=null;denies(a,'agent_grant_required');
    const b=fixture();b.actorId='owner-1';denies(b,'agent_grant_required');
  });
  it('enforces revocation, expiry, purpose and consumer scope',()=>{
    const a=fixture();a.grant!.revokedAt=a.now;denies(a,'agent_grant_revoked');
    const b=fixture();b.grant!.expiresAt=b.now;denies(b,'agent_grant_expired');
    const c=fixture();c.purpose='public_release';denies(c,'purpose_not_consented');
    const d=fixture();d.consumerId='other-agent';denies(d,'consumer_not_consented');
    const e=fixture();e.grant!.permittedPurposes=[];denies(e,'purpose_not_granted');
  });
  it('does not invent multilingual or speaking-style capability',()=>{
    const a=fixture();a.locale='en-US';denies(a,'locale_not_granted');
    const b=fixture();b.style='energetic';denies(b,'style_not_granted');
    const c=fixture();c.binding!.verifiedLocales=[];denies(c,'locale_unverified');
    const d=fixture();d.binding!.verifiedStyles=[];denies(d,'style_unverified');
  });
  it('does not silently route to third-party voice synthesis',()=>{
    const a=fixture();a.binding!.backend='external_adapter';denies(a,'external_provider_not_approved');
    a.allowExternalProvider=true;
    expect(authorizeAgentSpeech(a)).toMatchObject({allowed:true,backend:'external_adapter'});
  });
  it('blocks unavailable providers and invalid text',()=>{
    const a=fixture();a.binding!.status='pending';denies(a,'provider_unavailable');
    const b=fixture();b.binding!.capabilities.audioExport=false;denies(b,'provider_capability_missing');
    const c=fixture();c.text=' ';denies(c,'invalid_request');
    const d=fixture();d.profile.status='deleted';denies(d,'profile_unavailable');
  });
  it('audits before synthesis without exposing private text/voice references',async()=>{
    const events: unknown[]=[];
    const adapter={backend:'atlas_local' as const,synthesize:vi.fn(async()=>new Uint8Array([1,2]))};
    expect(await executeAgentSpeech(fixture(),{adapter,audit:async event=>{events.push(event)}}))
      .toEqual({ok:true,audio:new Uint8Array([1,2])});
    expect(adapter.synthesize).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(events)).not.toContain('private:voice-1');
    expect(JSON.stringify(events)).not.toContain('Prueba de voz sintética');
    expect(events).toHaveLength(2);
  });
  it('fails closed on audit outage, revoked grant or empty provider output',async()=>{
    const adapter={backend:'atlas_local' as const,synthesize:vi.fn(async()=>new Uint8Array([1]))};
    await expect(executeAgentSpeech(fixture(),{adapter,audit:async()=>{throw new Error('audit-failed')}}))
      .rejects.toThrow('audit-failed');
    expect(adapter.synthesize).not.toHaveBeenCalled();
    const a=fixture();a.grant!.revokedAt=a.now;
    expect(await executeAgentSpeech(a,{adapter,audit:async()=>{}})).toEqual({ok:false,reason:'agent_grant_revoked'});
    const empty={backend:'atlas_local' as const,synthesize:vi.fn(async()=>new Uint8Array())};
    expect(await executeAgentSpeech(fixture(),{adapter:empty,audit:async()=>{}}))
      .toEqual({ok:false,reason:'adapter_failed'});
  });
});
