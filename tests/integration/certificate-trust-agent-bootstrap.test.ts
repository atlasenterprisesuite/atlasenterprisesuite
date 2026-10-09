import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  resolveAgentProfile,
  isCertificateTrustProfile,
  capabilitiesForAgentProfile,
  modulesForAgentProfile,
} from '../../tools/local-agent/lib/agent-profile.mjs';

const read=(p:string)=>readFileSync(p,'utf8');
const agent=read('tools/local-agent/atlas-local-agent.mjs');
const edge=read('supabase/functions/atlas-local-control/index.ts');
const web=read('apps/web/src/modules/device-os/LocalControlPlanePanel.tsx');
const linux=read('tools/local-agent/install-linux.sh');
const mac=read('tools/local-agent/install-macos.sh');
const windows=read('tools/local-agent/install-windows.ps1');
const modules=['realtime-client.mjs','secure-state.mjs','browser-cdp.mjs','device-dna-linux.mjs','agent-profile.mjs'];

describe('ATLAS authorized certificate trust agent',()=>{
  it('rejects unknown profiles without granting fallback permissions',()=>{
    expect(resolveAgentProfile('certificate-trust')).toBe('certificate-trust');
    expect(isCertificateTrustProfile('certificate-trust')).toBe(true);
    expect(()=>resolveAgentProfile('admin')).toThrow('unsupported_agent_profile');
    expect(()=>resolveAgentProfile('browser-cdp')).toThrow('unsupported_agent_profile');
  });
  it('sets a least-privilege capability declaration and never allows browser/device operations',()=>{
    const permissions=capabilitiesForAgentProfile('certificate-trust',{deviceDnaEnabled:true});
    expect(permissions).toEqual(['heartbeat','command.realtime']);
    expect(permissions).not.toContain('browser.cdp');
    expect(permissions).not.toContain('command.poll');
    expect(permissions).not.toContain('device.dna.read');
    expect(modulesForAgentProfile('certificate-trust')).toEqual(['device-os','security','certificate-lifecycle']);
    expect(agent).toContain('if (CERTIFICATE_TRUST_ONLY) return [];');
    expect(agent).toContain('if (CERTIFICATE_TRUST_ONLY) return;');
    expect(agent).toContain('if (!CERTIFICATE_TRUST_ONLY) await syncDevices()');
    expect(agent).toContain('!CERTIFICATE_TRUST_ONLY && process.platform');
  });
  it('preserves standard agent functionality',()=>{
    expect(capabilitiesForAgentProfile('standard',{deviceDnaEnabled:true})).toContain('device.dna.read');
    expect(capabilitiesForAgentProfile('standard')).toContain('browser.cdp');
    expect(modulesForAgentProfile('standard')).toContain('hospitality');
  });
  it('copies the full static import closure before starting the persistent service',()=>{
    for(const item of modules){
      expect(linux).toContain('"$SOURCE_DIR/lib/'+item+'"');
      expect(mac).toContain('"$SOURCE_DIR/lib/'+item+'"');
      expect(windows).toContain('"lib\\'+item+'"');
    }
    expect(linux).toContain('node --check "$INSTALL_DIR/atlas-local-agent.mjs"');
    expect(mac).toContain('node --check "$INSTALL_DIR/atlas-local-agent.mjs"');
    expect(windows).toContain('& $node --check');
    expect(linux).toContain('ATLAS_AGENT_PROFILE=$AGENT_PROFILE');
    expect(mac).toContain('<key>ATLAS_AGENT_PROFILE</key>');
    expect(windows).toContain('ATLAS_AGENT_PROFILE');
    for(const [name,installer] of [['linux',linux],['macOS',mac],['Windows',windows]]){
      expect(installer,name).toContain('certificate-trust');
    }
  });
  it('keeps all enrollment authority server-side, scoped to an authenticated admin and a short-lived code',()=>{
    expect(edge).toContain("operation === 'enrollment.create'");
    expect(edge).toContain("requirePermission(context, 'device.agent.admin')");
    expect(edge).toContain('const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString()');
    expect(edge).toContain('.is(\'used_at\', null)');
    expect(web).toContain('createLocalAgentEnrollment(agentName)');
    expect(web).toContain('Do not paste this code into chat');
    expect(agent).toContain("post('agent.enroll'");
    expect(agent).toContain('consumeEnrollmentFile(enrollment.file)');
  });
  it('never claims device certificate is authorized before a live Cloudflare mTLS proof',()=>{
    expect(edge).toContain("operation === 'agent.bus.verify'");
    expect(edge).toContain("String(context.agent.mtls_status) !== 'active'");
    expect(edge).toContain('mtls_fingerprint_mismatch');
    expect(edge).toContain('mtls_certificate_expired');
    expect(read('.github/workflows/local-agent-mtls.yml')).toContain('mtls-provision-callback');
  });
});
