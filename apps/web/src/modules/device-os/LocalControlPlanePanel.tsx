import { useEffect, useMemo, useState } from 'react';
import {
  bindLocalAgentMtls,\n  createLocalAgentEnrollment,
  enqueueLocalDeviceCommand,
  listLocalAgents,
  listLocalCommands,
  listLocalDevices,
  revokeLocalAgent,\n  revokeLocalAgentMtls,
  type AtlasLocalAgent,
  type AtlasLocalCommand,
  type AtlasLocalDevice
} from './localControlApi';

function errorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : 'local_control_failed';
  const known: Record<string,string> = {
    permission_required: 'Your ATLAS role does not permit this Local Control action.',
    approved_execution_approval_required: 'High-risk device actions require an approved ATLAS Execution approval.',
    capability_not_declared: 'The selected device did not declare that capability.',
    device_not_found: 'The registered device is no longer available.'
  };
  return known[code] || code.replaceAll('_', ' ');
}

export function LocalControlPlanePanel() {
  const [agents,setAgents]=useState<AtlasLocalAgent[]>([]);
  const [devices,setDevices]=useState<AtlasLocalDevice[]>([]);
  const [commands,setCommands]=useState<AtlasLocalCommand[]>([]);
  const [agentName,setAgentName]=useState('');
  const [enrollmentCode,setEnrollmentCode]=useState<string|null>(null);
  const [enrollmentExpires,setEnrollmentExpires]=useState<string|null>(null);
  const [status,setStatus]=useState('Loading Local Control Plane…');\n  const [mtlsAgentId,setMtlsAgentId]=useState('');\n  const [mtlsFingerprint,setMtlsFingerprint]=useState('');\n  const [mtlsSerial,setMtlsSerial]=useState('');\n  const [mtlsExpires,setMtlsExpires]=useState('');
  const [busy,setBusy]=useState(false);

  async function refresh() {
    try {
      const [a,d,c]=await Promise.all([listLocalAgents(),listLocalDevices(),listLocalCommands()]);
      setAgents(a); setDevices(d); setCommands(c);
      setStatus(`${a.length} agent(s), ${d.length} device(s), ${c.filter(x=>x.status==='queued'||x.status==='claimed').length} active command(s).`);
    } catch(error) { setStatus(errorMessage(error)); }
  }
  useEffect(()=>{ void refresh(); },[]);
  const agentById=useMemo(()=>new Map(agents.map(a=>[a.id,a])),[agents]);

  async function createEnrollment() {
    setBusy(true);
    try {
      const result=await createLocalAgentEnrollment(agentName);
      setEnrollmentCode(result.enrollment_code);
      setEnrollmentExpires(result.enrollment.expires_at);
      setAgentName('');
      setStatus('One-time enrollment code created. It is shown only in this browser state; ATLAS stores only its digest.');
    } catch(error) { setStatus(errorMessage(error)); }
    finally { setBusy(false); }
  }

  async function revoke(id:string) {
    setBusy(true);
    try { await revokeLocalAgent(id); await refresh(); }
    catch(error) { setStatus(errorMessage(error)); }
    finally { setBusy(false); }
  }

  async function healthCheck(device:AtlasLocalDevice) {
    setBusy(true);
    try {
      const capability=device.capabilities.includes('health.check') ? 'health.check' : device.capabilities[0];
      if (!capability) throw new Error('device_has_no_declared_capabilities');
      const result=await enqueueLocalDeviceCommand({deviceId:device.id,agentId:device.agent_id,capability,action:'status.read',riskLevel:'low'});\n      setStatus(result.realtime.delivered > 0 ? 'Command queued and realtime agent notified.' : 'Command queued. Realtime unavailable; polling fallback remains active.');
      await refresh();
    } catch(error) { setStatus(errorMessage(error)); }
    finally { setBusy(false); }
  }

  return <article className="feature-card wide" aria-labelledby="local-control-title">
    <div className="card-heading">
      <div><p className="eyebrow">ATLAS Local Control Plane</p><h2 id="local-control-title">Agents & Devices</h2></div>
      <span className="status-chip neutral">Zero Trust</span>
    </div>
    <p>Use a Local Agent when a device cannot expose a browser-safe CORS endpoint. Enrollment and sessions are short-lived; secrets are never stored in browser persistence or device telemetry.</p>
    <div className="notice">No LAN scanning. No device is shown as connected unless a registered agent reports it. High/critical actions remain bound to ATLAS Approval Center.</div>

    <div className="filter-row">
      <label>Agent name<input value={agentName} onChange={e=>setAgentName(e.target.value)} placeholder="Front Desk Agent" /></label>
      <button type="button" disabled={busy||!agentName.trim()} onClick={()=>void createEnrollment()}>Create one-time enrollment</button>
    </div>
    {enrollmentCode ? <div className="notice strong" role="status">
      <strong>One-time enrollment code</strong>
      <p><code>{enrollmentCode}</code></p>
      <small>Expires {enrollmentExpires ? new Date(enrollmentExpires).toLocaleString() : 'soon'}. Do not paste this code into chat, tickets or source control.</small>
      <div><button type="button" onClick={()=>{setEnrollmentCode(null);setEnrollmentExpires(null);}}>Hide code</button></div>
    </div> : null}

    <div className="notice" role="status">{status}</div>

    <h3>mTLS certificate binding</h3>
    <div className="filter-row">
      <label>Agent
        <select value={mtlsAgentId} onChange={e=>setMtlsAgentId(e.target.value)}>
          <option value="">Select agent</option>
          {agents.filter(agent=>agent.status!=='revoked').map(agent=><option key={agent.id} value={agent.id}>{agent.name}</option>)}
        </select>
      </label>
      <label>SHA-256 fingerprint<input value={mtlsFingerprint} onChange={e=>setMtlsFingerprint(e.target.value.toLowerCase())} placeholder="64 hex characters" /></label>
      <label>Certificate serial<input value={mtlsSerial} onChange={e=>setMtlsSerial(e.target.value)} /></label>
      <label>Expires at<input type="datetime-local" value={mtlsExpires} onChange={e=>setMtlsExpires(e.target.value)} /></label>
      <button type="button" disabled={busy||!mtlsAgentId||!/^[a-f0-9]{64}$/.test(mtlsFingerprint)||!mtlsSerial||!mtlsExpires} onClick={()=>void (async()=>{
        setBusy(true);
        try {
          await bindLocalAgentMtls({agentId:mtlsAgentId,fingerprintSha256:mtlsFingerprint,serial:mtlsSerial,expiresAt:new Date(mtlsExpires).toISOString()});
          setMtlsFingerprint(''); setMtlsSerial(''); setMtlsExpires('');
          await refresh();
          setStatus('mTLS certificate metadata bound. Realtime opens only when Cloudflare validates that exact certificate.');
        } catch(error) { setStatus(errorMessage(error)); }
        finally { setBusy(false); }
      })()}>Bind mTLS certificate</button>
    </div>

    <h3>Registered agents</h3>
    <div className="module-grid compact">
      {agents.map(agent=><div className="module-card" key={agent.id}>
        <span>{agent.platform} · {agent.agent_version}</span><strong>{agent.name}</strong>
        <p>{agent.capabilities.length ? agent.capabilities.join(', ') : 'No capabilities reported yet.'}</p>
        <span className={agent.status==='online'?'status-chip':'status-chip warning'}>{agent.status}</span>
        <button type="button" disabled={busy||agent.status==='revoked'} onClick={()=>void revoke(agent.id)}>Revoke</button>
      </div>)}
    </div>

    <h3>Devices</h3>
    <div className="module-grid compact">
      {devices.map(device=><div className="module-card" key={device.id}>
        <span>{device.device_type} · {device.adapter}</span><strong>{device.label}</strong>
        <p>Agent: {agentById.get(device.agent_id)?.name || 'Unknown'} · {device.capabilities.join(', ') || 'No capabilities'}</p>
        <span className={device.health_status==='healthy'?'status-chip':'status-chip warning'}>{device.health_status}</span>
        <button type="button" disabled={busy||!device.capabilities.length} onClick={()=>void healthCheck(device)}>Queue status check</button>
      </div>)}
    </div>

    <h3>Recent commands</h3>
    <div className="module-grid compact">
      {commands.slice(0,12).map(command=><div className="module-card" key={command.id}>
        <span>{command.risk_level} · {command.status}</span><strong>{command.action}</strong>
        <p>{command.capability}{command.error_code ? ` · ${command.error_code}` : ''}</p>
      </div>)}
    </div>
  </article>;
}
