#!/usr/bin/env node
import { connectMtlsWebSocket } from './lib/realtime-client.mjs';
import { executeBrowserCdpAction } from './lib/browser-cdp.mjs';
import {
  consumeEnrollmentFile,
  loadAgentState,
  readEnrollmentCode,
  readExplicitDevices,
  readMtlsMaterial,
  runtimeIdentity,
  saveAgentState
} from './lib/secure-state.mjs';

const CONTROL_URL = String(
  process.env.ATLAS_LOCAL_CONTROL_URL ||
  'https://ggmanzcgtlrvqfoccgsh.supabase.co/functions/v1/atlas-local-control'
).trim();
const REALTIME_URL = String(
  process.env.ATLAS_AGENT_REALTIME_URL ||
  'wss://www.atlasenterprisesuite.com/_atlas/local-bus/connect'
).trim();
const PLATFORM = String(process.env.ATLAS_AGENT_PLATFORM || process.platform).slice(0, 120);
const VERSION = '1.1.0';
const HEARTBEAT_MS = 30_000;
const FALLBACK_POLL_MS = 30_000;
const REALTIME_RETRY_MAX_MS = 60_000;

let state = await loadAgentState();
let sessionToken = String(process.env.ATLAS_AGENT_SESSION_TOKEN || state.sessionToken || '').trim();
let realtimeConnected = false;
let realtimeClient = null;
let realtimeRetryMs = 2_000;
let draining = false;

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

async function readDeviceConfig() {
  const parsed = await readExplicitDevices();
  return parsed.slice(0,100).map((item,index)=>{
    const adapter = String(item.adapter || 'http-health').trim();
    const base = {
      external_id: String(item.external_id || '').trim(),
      label: String(item.label || '').trim(),
      device_type: String(item.device_type || (adapter === 'browser-cdp' ? 'browser' : 'service')).trim(),
      adapter,
      capabilities: Array.isArray(item.capabilities)
        ? item.capabilities.map(String)
        : (adapter === 'browser-cdp' ? ['browser.control'] : ['health.check']),
      health_status: 'unknown',
      metadata: item.metadata && typeof item.metadata === 'object' && !Array.isArray(item.metadata) ? item.metadata : {}
    };
    if (adapter === 'browser-cdp') {
      const allowed = Array.isArray(base.metadata.allowed_domains)
        ? base.metadata.allowed_domains.map((value)=>String(value || '').trim().toLowerCase()).filter(Boolean)
        : [];
      if (!allowed.length) throw new Error(`Device ${index} browser-cdp adapter requires metadata.allowed_domains`);
      return { ...base, metadata: { allowed_domains: [...new Set(allowed)].slice(0,50) } };
    }
    const endpoint = new URL(String(item.endpoint || ''));
    if (!['http:','https:'].includes(endpoint.protocol) || !localHostname(endpoint.hostname) || endpoint.username || endpoint.password) {
      throw new Error(`Device ${index} endpoint must be an explicit local HTTP(S) URL without embedded credentials`);
    }
    return { ...base, endpoint: endpoint.toString() };
  }).filter(d=>d.external_id && d.label);
}

const devices = await readDeviceConfig();
let deviceByServerId = new Map();

async function persistSession(result = {}) {
  if (result.session_token) sessionToken = String(result.session_token);
  state = {
    ...state,
    sessionToken,
    sessionExpiresAt: String(result.session_expires_at || state.sessionExpiresAt || ''),
    updatedAt: new Date().toISOString()
  };
  await saveAgentState(state);
}

async function post(operation, body={}, agentAuth=true) {
  const headers = {'content-type':'application/json'};
  if (agentAuth) {
    if (!sessionToken) throw new Error('agent_session_required');
    headers['x-atlas-agent-token'] = sessionToken;
  }
  const response = await fetch(CONTROL_URL, {
    method:'POST', headers,
    body:JSON.stringify({operation,...body}),
    signal:AbortSignal.timeout(15_000)
  });
  const result = await response.json().catch(()=>({}));
  if (!response.ok || result.ok !== true) {
    throw Object.assign(new Error(result.error || `local_control_http_${response.status}`), {status:response.status});
  }
  return result;
}

async function enroll() {
  if (sessionToken) return;
  const enrollment = await readEnrollmentCode();
  if (!enrollment) throw new Error('agent_reenrollment_required');
  const result = await post('agent.enroll', {
    enrollment_code: enrollment.value,
    platform: PLATFORM,
    agent_version: VERSION,
    installer_version: VERSION,
    capabilities: ['heartbeat','device.inventory','command.poll','command.realtime','http-health','browser.cdp'],
    modules: ['device-os','connect','hospitality','browser-operator']
  }, false);
  sessionToken = String(result.session_token || '');
  if (!sessionToken) throw new Error('enrollment_did_not_return_session');
  state = {
    ...state,
    agentId: String(result.agent?.id || ''),
    organizationId: String(result.agent?.org_id || ''),
    sessionToken,
    sessionExpiresAt: String(result.session_expires_at || ''),
    enrolledAt: new Date().toISOString(),
    runtime: runtimeIdentity()
  };
  await saveAgentState(state);
  await consumeEnrollmentFile(enrollment.file);
  delete process.env.ATLAS_AGENT_ENROLLMENT_CODE;
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
    capabilities: ['heartbeat','device.inventory','command.poll','command.realtime','http-health','browser.cdp'],
    modules: ['device-os','connect','hospitality','browser-operator']
  });
  if (result.session_token || result.session_expires_at) await persistSession(result);
}

async function execute(command) {
  const device = deviceByServerId.get(String(command.device_id));
  if (!device) return {success:false,error_code:'device_not_configured_locally'};

  if (device.adapter === 'browser-cdp' && command.capability === 'browser.control') {
    try {
      const outcome = await executeBrowserCdpAction(device,String(command.action || ''),command.action_payload || {});
      await post('agent.events.append', {
        device_id: String(command.device_id),
        event_type: 'browser.action.completed',
        severity: 'info',
        success: true,
        safe_detail: {
          action: String(command.action || '').slice(0,120),
          url: String(outcome?.result?.url || '').slice(0,1500),
          title: String(outcome?.result?.title || '').slice(0,500)
        }
      });
      return {success:true};
    } catch (error) {
      const code = String(error?.message || 'browser_action_failed').slice(0,120);
      await post('agent.events.append', {
        device_id: String(command.device_id),
        event_type: 'browser.action.failed',
        severity: 'warning',
        success: false,
        safe_detail: { action: String(command.action || '').slice(0,120), error_code: code }
      }).catch(()=>{});
      return {success:false,error_code:code};
    }
  }

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

async function claimAndExecute() {
  const result = await post('agent.commands.claim');
  if (!result.command) return false;
  const outcome = await execute(result.command);
  await post('agent.commands.complete', {
    command_id: result.command.id,
    success: outcome.success,
    ...(outcome.success ? {} : {error_code: outcome.error_code})
  });
  return true;
}

async function drainCommands() {
  if (draining) return;
  draining = true;
  try {
    for (let count = 0; count < 20; count += 1) {
      if (!await claimAndExecute()) break;
    }
  } finally {
    draining = false;
  }
}

async function realtimeLoop() {
  while (true) {
    const mtls = await readMtlsMaterial().catch(()=>null);
    if (!mtls || !sessionToken) {
      realtimeConnected = false;
      await new Promise(resolve=>setTimeout(resolve, REALTIME_RETRY_MAX_MS));
      continue;
    }

    try {
      realtimeClient = await connectMtlsWebSocket({
        url: REALTIME_URL,
        certificate: mtls.certificate,
        privateKey: mtls.privateKey,
        headers: {'x-atlas-agent-token': sessionToken},
        onMessage(message) {
          try {
            const event = JSON.parse(message);
            if (event?.event === 'bus.ready') realtimeConnected = true;
            if (event?.event === 'command.ready' && event.command_id) void drainCommands();
          } catch {}
        },
        onClose() {
          realtimeConnected = false;
          realtimeClient = null;
        }
      });
      realtimeConnected = true;
      realtimeRetryMs = 2_000;
      const pingTimer = setInterval(()=>realtimeClient?.ping(),20_000);
      while (realtimeConnected) await new Promise(resolve=>setTimeout(resolve,1_000));
      clearInterval(pingTimer);
    } catch {
      realtimeConnected = false;
      realtimeClient = null;
      await new Promise(resolve=>setTimeout(resolve,realtimeRetryMs));
      realtimeRetryMs = Math.min(realtimeRetryMs * 2, REALTIME_RETRY_MAX_MS);
    }
  }
}

async function main() {
  await enroll();
  await syncDevices();
  await heartbeat();

  setInterval(()=>heartbeat().catch((error)=>{
    if (error?.status === 401) process.stderr.write('ATLAS Local Agent session expired; re-enrollment is required.\n');
  }), HEARTBEAT_MS);

  setInterval(()=>{
    if (!realtimeConnected) void drainCommands().catch(()=>{});
  }, FALLBACK_POLL_MS);

  void realtimeLoop();
  await drainCommands();

  process.stdout.write(`ATLAS Local Agent ${VERSION} running. Realtime uses mTLS when configured; polling is fallback only.\n`);
  await new Promise(()=>{});
}

process.on('SIGTERM',()=>{
  try { realtimeClient?.close(); } catch {}
  process.exit(0);
});
process.on('SIGINT',()=>{
  try { realtimeClient?.close(); } catch {}
  process.exit(0);
});

main().catch((error)=>{
  process.stderr.write(`ATLAS Local Agent stopped: ${error?.message || 'runtime_error'}\n`);
  process.exitCode=1;
});
