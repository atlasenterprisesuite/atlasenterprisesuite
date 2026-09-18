#!/usr/bin/env node
const CONTROL_URL = String(process.env.ATLAS_LOCAL_CONTROL_URL || '').trim();
const ENROLLMENT_CODE = String(process.env.ATLAS_AGENT_ENROLLMENT_CODE || '').trim();
let sessionToken = String(process.env.ATLAS_AGENT_SESSION_TOKEN || '').trim();
const PLATFORM = String(process.env.ATLAS_AGENT_PLATFORM || process.platform).slice(0, 120);
const VERSION = '0.1.0';
const HEARTBEAT_MS = 30_000;
const POLL_MS = 3_000;

if (!CONTROL_URL) throw new Error('ATLAS_LOCAL_CONTROL_URL is required');
if (!ENROLLMENT_CODE && !sessionToken) throw new Error('Enrollment code or short-lived agent session token is required');

function localHostname(hostname) {
  const h = hostname.replace(/^\[/,'').replace(/\]$/,'').toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h === '::1' || h.endsWith('.local')) return true;
  const p = h.split('.').map(Number);
  if (p.length === 4 && p.every(Number.isInteger)) {
    const [a,b] = p;
    return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127);
  }
  return /^f[cd][0-9a-f]{2}:/i.test(h) || /^fe[89ab][0-9a-f]:/i.test(h);
}

function readDeviceConfig() {
  const raw = String(process.env.ATLAS_LOCAL_DEVICES_JSON || '[]');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('ATLAS_LOCAL_DEVICES_JSON must be a JSON array');
  return parsed.slice(0,100).map((item,index)=>{
    const endpoint = new URL(String(item.endpoint || ''));
    if (!['http:','https:'].includes(endpoint.protocol) || !localHostname(endpoint.hostname) || endpoint.username || endpoint.password) {
      throw new Error(`Device ${index} endpoint must be an explicit local HTTP(S) URL without embedded credentials`);
    }
    return {
      external_id: String(item.external_id || '').trim(),
      label: String(item.label || '').trim(),
      device_type: String(item.device_type || 'service').trim(),
      adapter: String(item.adapter || 'http-health').trim(),
      capabilities: Array.isArray(item.capabilities) ? item.capabilities.map(String) : ['health.check'],
      health_status: 'unknown',
      endpoint: endpoint.toString()
    };
  }).filter(d=>d.external_id && d.label);
}

const devices = readDeviceConfig();
let deviceByServerId = new Map();

async function post(operation, body={}, agentAuth=true) {
  const headers = {'content-type':'application/json'};
  if (agentAuth) headers['x-atlas-agent-token'] = sessionToken;
  const response = await fetch(CONTROL_URL, {
    method:'POST', headers,
    body:JSON.stringify({operation,...body}),
    signal:AbortSignal.timeout(15_000)
  });
  const result = await response.json().catch(()=>({}));
  if (!response.ok || result.ok !== true) throw Object.assign(new Error(result.error || `local_control_http_${response.status}`), {status:response.status});
  return result;
}

async function enroll() {
  if (sessionToken) return;
  const code = ENROLLMENT_CODE;
  const result = await post('agent.enroll', {
    enrollment_code: code,
    platform: PLATFORM,
    agent_version: VERSION,
    capabilities: ['heartbeat','device.inventory','command.poll','http-health'],
    modules: ['device-os','connect','hospitality']
  }, false);
  sessionToken = String(result.session_token || '');
  delete process.env.ATLAS_AGENT_ENROLLMENT_CODE;
  if (!sessionToken) throw new Error('Enrollment did not return a session token');
}

async function syncDevices() {
  const safeDevices = devices.map(({endpoint,...device})=>device);
  const result = await post('agent.devices.sync', {devices:safeDevices});
  const ids = Array.isArray(result.device_ids) ? result.device_ids : [];
  deviceByServerId = new Map(ids.map((id,index)=>[String(id),devices[index]]).filter(([,device])=>Boolean(device)));
}

async function heartbeat() {
  const result = await post('agent.heartbeat', {
    platform: PLATFORM,
    agent_version: VERSION,
    capabilities: ['heartbeat','device.inventory','command.poll','http-health'],
    modules: ['device-os','connect','hospitality']
  });
  if (result.session_token) sessionToken = String(result.session_token);
}

async function execute(command) {
  const device = deviceByServerId.get(String(command.device_id));
  if (!device) return {success:false,error_code:'device_not_configured_locally'};
  if (device.adapter !== 'http-health' || command.capability !== 'health.check' || command.action !== 'status.read') {
    return {success:false,error_code:'unsupported_adapter_or_action'};
  }
  try {
    const response = await fetch(device.endpoint, {
      method:'GET', redirect:'error', cache:'no-store', credentials:'omit',
      signal:AbortSignal.timeout(5_000)
    });
    await post('agent.events.append', {
      device_id: String(command.device_id),
      event_type: 'device.health.observed',
      severity: response.ok ? 'info' : 'warning',
      success: response.ok,
      safe_detail: {http_status: response.status}
    });
    return response.ok
      ? {success:true}
      : {success:false,error_code:`local_http_status_${response.status}`};
  } catch {
    return {success:false,error_code:'local_endpoint_unreachable'};
  }
}

async function poll() {
  const result = await post('agent.commands.claim');
  if (!result.command) return;
  const outcome = await execute(result.command);
  await post('agent.commands.complete', {
    command_id: result.command.id,
    success: outcome.success,
    ...(outcome.success ? {} : {error_code: outcome.error_code})
  });
}

async function main() {
  await enroll();
  await syncDevices();
  await heartbeat();
  setInterval(()=>heartbeat().catch(()=>{}), HEARTBEAT_MS);
  while (true) {
    try { await poll(); } catch {}
    await new Promise(resolve=>setTimeout(resolve,POLL_MS));
  }
}

main().catch((error)=>{
  process.stderr.write(`ATLAS Local Agent stopped: ${error?.message || 'runtime_error'}\n`);
  process.exitCode=1;
});
