import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DEFAULT_PORT = 9222;
const DEFAULT_ALLOWED_ACTIONS = new Set(['navigate','read_text','click','type','submit','oauth_consent','diagnose']);
const SENSITIVE_TARGET = /password|passwd|passcode|secret|token|otp|one.?time|verification.?code|mfa|2fa|credit.?card|cvv|cvc|ssn|social.?security/i;
const OAUTH_CONSENT_TEXT = /\b(authorize|allow|grant|choose account|connect(?: app)?|approve|consent)\b/i;
const INTERACTIVE_SELECTOR = 'button,a,[role="button"],input[type="button"],input[type="submit"]';

function normalizeHostname(value) {
  return String(value || '').trim().toLowerCase().replace(/^https?:\/\//,'').split('/')[0].replace(/\.$/,'');
}

export function browserDomainAllowed(domain, allowedDomains) {
  const hostname = normalizeHostname(domain);
  return Boolean(hostname) && allowedDomains.some((allowed) => {
    const candidate = normalizeHostname(allowed);
    return Boolean(candidate) && (hostname === candidate || hostname.endsWith('.' + candidate));
  });
}

function browserMetadata(device) {
  const metadata = device?.metadata && typeof device.metadata === 'object' ? device.metadata : {};
  const allowedDomains = Array.isArray(metadata.allowed_domains)
    ? [...new Set(metadata.allowed_domains.map(normalizeHostname).filter(Boolean))].slice(0,50)
    : [];
  if (!allowedDomains.length) throw new Error('browser_allowed_domains_required');
  return { allowedDomains };
}

function candidateExecutables() {
  if (process.env.ATLAS_BROWSER_EXECUTABLE) return [process.env.ATLAS_BROWSER_EXECUTABLE];
  if (process.platform === 'darwin') {
    return [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    ];
  }
  if (process.platform === 'win32') {
    const roots = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean);
    return roots.flatMap((root) => [
      join(root,'Google','Chrome','Application','chrome.exe'),
      join(root,'Google','Chrome for Testing','Application','chrome.exe'),
      join(root,'Chromium','Application','chrome.exe')
    ]);
  }
  return ['/usr/bin/google-chrome','/usr/bin/google-chrome-stable','/usr/bin/chromium','/usr/bin/chromium-browser'];
}

function resolveExecutable() {
  const executable = candidateExecutables().find((value) => value && existsSync(value));
  if (!executable) throw new Error('browser_executable_not_found');
  return executable;
}

function operatorPort() {
  const parsed = Number(process.env.ATLAS_BROWSER_CDP_PORT || DEFAULT_PORT);
  return Number.isInteger(parsed) && parsed >= 1024 && parsed <= 65535 ? parsed : DEFAULT_PORT;
}

async function versionEndpoint(port) {
  const response = await fetch('http://127.0.0.1:' + port + '/json/version', {
    cache:'no-store',
    signal:AbortSignal.timeout(1500)
  });
  if (!response.ok) throw new Error('browser_cdp_unavailable');
  return response.json();
}

async function launchBrowser(port) {
  const profile = process.env.ATLAS_BROWSER_PROFILE_DIR || join(homedir(),'.atlas','browser-operator');
  await mkdir(profile,{recursive:true,mode:0o700});
  const args = [
    '--remote-debugging-address=127.0.0.1',
    '--remote-debugging-port=' + port,
    '--user-data-dir=' + profile,
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ];
  if (String(process.env.ATLAS_BROWSER_HEADLESS || '').toLowerCase() === 'true') args.unshift('--headless=new');
  const child = spawn(resolveExecutable(),args,{detached:true,stdio:'ignore'});
  child.unref();
  for (let attempt=0; attempt<40; attempt+=1) {
    await new Promise((resolve)=>setTimeout(resolve,250));
    try { await versionEndpoint(port); return; } catch {}
  }
  throw new Error('browser_cdp_start_failed');
}

async function ensureBrowser() {
  const port = operatorPort();
  try { await versionEndpoint(port); } catch { await launchBrowser(port); }
  return port;
}

async function pageTarget(port) {
  const response = await fetch('http://127.0.0.1:' + port + '/json/list', {
    cache:'no-store', signal:AbortSignal.timeout(2000)
  });
  const targets = await response.json();
  const page = Array.isArray(targets) ? targets.find((item)=>item?.type === 'page' && item.webSocketDebuggerUrl) : null;
  if (!page) throw new Error('browser_page_target_missing');
  return page;
}

class CdpSession {
  constructor(url) {
    this.url = url;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.socket = null;
  }
  async connect() {
    this.socket = new WebSocket(this.url);
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('browser_cdp_connect_timeout')),5000);
      this.socket.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});
      this.socket.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('browser_cdp_connect_failed'));},{once:true});
    });
    this.socket.addEventListener('message',(event)=>{
      let message;
      try { message=JSON.parse(String(event.data || '')); } catch { return; }
      if (!message?.id) {
        const handlers=this.listeners.get(String(message?.method || '')) || [];
        for (const handler of handlers) { try { handler(message.params || {}); } catch {} }
        return;
      }
      const pending=this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(String(message.error.message || 'browser_cdp_error')));
      else pending.resolve(message.result);
    });
  }
  send(method,params={}) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return Promise.reject(new Error('browser_cdp_not_connected'));
    const id=this.nextId++;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{
        this.pending.delete(id);
        reject(new Error('browser_cdp_command_timeout'));
      },12_000);
      this.pending.set(id,{
        resolve:(value)=>{clearTimeout(timer);resolve(value);},
        reject:(error)=>{clearTimeout(timer);reject(error);}
      });
      this.socket.send(JSON.stringify({id,method,params}));
    });
  }
  on(method,handler) {
    const key=String(method || '');
    const current=this.listeners.get(key) || [];
    current.push(handler);
    this.listeners.set(key,current);
  }
  close() { try { this.socket?.close(); } catch {} this.listeners.clear(); }
}

async function evaluate(session,expression) {
  const result=await session.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,userGesture:true});
  if (result?.exceptionDetails) throw new Error('browser_script_failed');
  return result?.result?.value;
}

async function currentLocation(session) {
  return evaluate(session,'({url:location.href,title:document.title,domain:location.hostname})');
}

function assertLocationAllowed(location,allowedDomains) {
  let url;
  try { url=new URL(String(location?.url || '')); } catch { throw new Error('browser_location_invalid'); }
  if (!browserDomainAllowed(url.hostname,allowedDomains)) throw new Error('browser_domain_not_allowed');
}

function expectedDomain(payload,allowedDomains) {
  const domain=normalizeHostname(payload?.domain);
  if (!domain || !browserDomainAllowed(domain,allowedDomains)) throw new Error('browser_expected_domain_required');
  return domain;
}

function assertExpectedDomain(location,expected) {
  const actual=normalizeHostname(location?.domain);
  if (!actual || actual !== normalizeHostname(expected)) throw new Error('browser_page_domain_mismatch');
}

function safePublicUrl(value) {
  try {
    const url=new URL(String(value || ''));
    url.username='';
    url.password='';
    url.search='';
    url.hash='';
    return url.toString().slice(0,1500);
  } catch {
    return '[redacted-url]';
  }
}


function safeTelemetryUrl(value) {
  try {
    const url=new URL(String(value || ''));
    url.username='';
    url.password='';
    url.search='';
    url.hash='';
    return `${url.origin}${url.pathname}`.slice(0,1500);
  } catch {
    return '[redacted-url]';
  }
}

function normalizeObservationMs(value) {
  const parsed=Number(value ?? 1200);
  if (!Number.isFinite(parsed)) return 1200;
  return Math.min(5000,Math.max(250,Math.round(parsed)));
}

async function collectCdpTelemetry(session,payload,allowedDomains) {
  const before=await currentLocation(session);
  assertLocationAllowed(before,allowedDomains);
  assertExpectedDomain(before,expectedDomain(payload,allowedDomains));

  const consoleErrors=[];
  const jsExceptions=[];
  const httpFailures=[];
  const networkFailures=[];
  const requestUrls=new Map();

  const pushLimited=(items,value,limit=50)=>{ if(items.length<limit)items.push(value); };

  session.on('Log.entryAdded',(event)=>{
    const entry=event?.entry || {};
    if (!['error','warning'].includes(String(entry.level || '').toLowerCase())) return;
    pushLimited(consoleErrors,{
      level:String(entry.level || '').slice(0,40),
      source:String(entry.source || '').slice(0,80),
      url:safeTelemetryUrl(entry.url),
      line:Number.isFinite(Number(entry.lineNumber)) ? Number(entry.lineNumber) : null
    });
  });
  session.on('Runtime.exceptionThrown',(event)=>{
    const details=event?.exceptionDetails || {};
    pushLimited(jsExceptions,{
      text:String(details.text || 'javascript_exception').slice(0,160),
      url:safeTelemetryUrl(details.url),
      line:Number.isFinite(Number(details.lineNumber)) ? Number(details.lineNumber) : null,
      column:Number.isFinite(Number(details.columnNumber)) ? Number(details.columnNumber) : null
    });
  });
  session.on('Network.requestWillBeSent',(event)=>{
    const requestId=String(event?.requestId || '');
    if (requestId) requestUrls.set(requestId,safeTelemetryUrl(event?.request?.url));
  });
  session.on('Network.responseReceived',(event)=>{
    const response=event?.response || {};
    const status=Number(response.status || 0);
    if (status < 400) return;
    pushLimited(httpFailures,{
      status,
      type:String(event?.type || '').slice(0,60),
      url:safeTelemetryUrl(response.url),
      mimeType:String(response.mimeType || '').slice(0,120)
    });
  });
  session.on('Network.loadingFailed',(event)=>{
    pushLimited(networkFailures,{
      type:String(event?.type || '').slice(0,60),
      url:requestUrls.get(String(event?.requestId || '')) || '[redacted-url]',
      error:String(event?.errorText || 'network_loading_failed').slice(0,160),
      canceled:Boolean(event?.canceled),
      blockedReason:String(event?.blockedReason || '').slice(0,80) || null
    });
  });

  await session.send('Log.enable');
  await session.send('Network.enable');
  await session.send('Runtime.enable');
  await session.send('Page.enable');

  if (payload?.reload === true) {
    await session.send('Page.reload',{ignoreCache:true});
  }
  await new Promise((resolve)=>setTimeout(resolve,normalizeObservationMs(payload?.observation_ms)));

  const metrics=await evaluate(session,`(async()=> {
    const nav=performance.getEntriesByType('navigation')[0];
    let lcp=null;
    let cls=0;
    try {
      await new Promise((resolve)=>{
        let pending=2;
        const done=()=>{ pending-=1; if(pending<=0)resolve(); };
        try {
          const observer=new PerformanceObserver((list)=>{
            const entries=list.getEntries();
            if(entries.length) lcp=entries[entries.length-1].startTime;
          });
          observer.observe({type:'largest-contentful-paint',buffered:true});
          setTimeout(()=>{observer.disconnect();done();},150);
        } catch { done(); }
        try {
          const observer=new PerformanceObserver((list)=>{
            for(const entry of list.getEntries()){
              if(!entry.hadRecentInput) cls+=entry.value||0;
            }
          });
          observer.observe({type:'layout-shift',buffered:true});
          setTimeout(()=>{observer.disconnect();done();},150);
        } catch { done(); }
      });
    } catch {}
    return {
      ttfb:nav ? nav.responseStart : null,
      domContentLoaded:nav ? nav.domContentLoadedEventEnd : null,
      load:nav ? nav.loadEventEnd : null,
      lcp,
      cls,
      resourceCount:performance.getEntriesByType('resource').length
    };
  })()`);

  const location=await currentLocation(session);
  assertLocationAllowed(location,allowedDomains);
  assertExpectedDomain(location,expectedDomain(payload,allowedDomains));

  return {
    success:true,
    result:{
      url:safePublicUrl(location.url),
      title:String(location.title || '').slice(0,500),
      telemetry:{
        observedAt:new Date().toISOString(),
        observationMs:normalizeObservationMs(payload?.observation_ms),
        reloaded:payload?.reload === true,
        consoleErrors,
        jsExceptions,
        httpFailures,
        networkFailures,
        metrics:{
          ttfb:Number.isFinite(Number(metrics?.ttfb)) ? Math.round(Number(metrics.ttfb)) : null,
          domContentLoaded:Number.isFinite(Number(metrics?.domContentLoaded)) ? Math.round(Number(metrics.domContentLoaded)) : null,
          load:Number.isFinite(Number(metrics?.load)) ? Math.round(Number(metrics.load)) : null,
          lcp:Number.isFinite(Number(metrics?.lcp)) ? Math.round(Number(metrics.lcp)) : null,
          cls:Number.isFinite(Number(metrics?.cls)) ? Number(metrics.cls.toFixed(4)) : null,
          resourceCount:Number.isFinite(Number(metrics?.resourceCount)) ? Number(metrics.resourceCount) : null
        }
      }
    }
  };
}

function targetSpec(target) {
  const raw=String(target || '').trim();
  if (!raw || raw.length > 1000 || /[\u0000-\u001f]/.test(raw)) throw new Error('browser_target_invalid');
  const lower=raw.toLowerCase();
  if (lower.startsWith('text:') || lower.startsWith('text=')) {
    const text=raw.slice(5).trim();
    if (!text || text.length > 240) throw new Error('browser_text_target_invalid');
    return {kind:'text',value:text};
  }
  return {kind:'css',value:raw};
}

function targetFinderSource(spec) {
  const encoded=JSON.stringify(spec);
  const interactive=JSON.stringify(INTERACTIVE_SELECTOR);
  return `
    const spec=${encoded};
    const normalized=(value)=>String(value||'').replace(/\\s+/g,' ').trim().toLowerCase();
    let matches=[];
    if(spec.kind==='text'){
      const wanted=normalized(spec.value);
      matches=Array.from(document.querySelectorAll(${interactive})).filter((el)=>{
        const label=el.getAttribute('aria-label')||el.innerText||el.textContent||el.value||'';
        return normalized(label)===wanted;
      });
    } else {
      try {
        const node=document.querySelector(spec.value);
        matches=node?[node]:[];
      } catch {
        matches=[];
      }
    }
  `;
}

async function elementSnapshot(session,spec) {
  const finder=targetFinderSource(spec);
  return evaluate(session,`(() => {
    ${finder}
    if(matches.length===0)return null;
    const el=matches[0];
    return {
      matchCount:matches.length,
      tag:String(el.tagName||'').toLowerCase(),
      type:String(el.type||'').toLowerCase(),
      name:String(el.name||''),
      id:String(el.id||''),
      autocomplete:String(el.autocomplete||''),
      text:String(el.getAttribute('aria-label')||el.innerText||el.textContent||el.value||'').trim().slice(0,500),
      disabled:Boolean(el.disabled),
      ariaDisabled:el.getAttribute('aria-disabled')==='true'
    };
  })()`);
}

function assertUnique(snapshot) {
  if (!snapshot) throw new Error('browser_target_not_found');
  if (snapshot.matchCount !== 1) throw new Error('browser_text_target_ambiguous');
  if (snapshot.disabled || snapshot.ariaDisabled) throw new Error('browser_target_disabled');
}

export function validateBrowserCommand(action,payload,allowedDomains) {
  if (!DEFAULT_ALLOWED_ACTIONS.has(action)) throw new Error('browser_action_not_supported');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('browser_action_payload_invalid');
  if (JSON.stringify(payload).length > 8000) throw new Error('browser_action_payload_too_large');
  if (action === 'navigate') {
    let url;
    try { url=new URL(String(payload.url || '')); } catch { throw new Error('browser_navigation_url_invalid'); }
    if (url.protocol !== 'https:' || url.username || url.password || !browserDomainAllowed(url.hostname,allowedDomains)) {
      throw new Error('browser_domain_not_allowed');
    }
  }
  if (['click','type','submit','oauth_consent','read_text'].includes(action)) {
    targetSpec(payload.target);
    expectedDomain(payload,allowedDomains);
  }
  if (action === 'diagnose') {
    expectedDomain(payload,allowedDomains);
    if (payload.reload !== undefined && typeof payload.reload !== 'boolean') throw new Error('browser_diagnose_reload_invalid');
    if (payload.observation_ms !== undefined) {
      const observationMs=Number(payload.observation_ms);
      if (!Number.isFinite(observationMs) || observationMs < 250 || observationMs > 5000) throw new Error('browser_diagnose_observation_invalid');
    }
  }
  if (action === 'type') {
    if (SENSITIVE_TARGET.test(String(payload.target || ''))) throw new Error('browser_sensitive_input_requires_human');
    if (payload.value === undefined || String(payload.value).length > 4000) throw new Error('browser_type_value_invalid');
  }
}

export async function executeBrowserCdpAction(device,action,payload={}) {
  const {allowedDomains}=browserMetadata(device);
  validateBrowserCommand(action,payload,allowedDomains);
  const port=await ensureBrowser();
  const target=await pageTarget(port);
  const session=new CdpSession(target.webSocketDebuggerUrl);
  await session.connect();
  try {
    await session.send('Page.enable');
    await session.send('Runtime.enable');
    if (action === 'navigate') {
      await session.send('Page.navigate',{url:String(payload.url)});
      await new Promise((resolve)=>setTimeout(resolve,700));
    } else if (action === 'diagnose') {
      return await collectCdpTelemetry(session,payload,allowedDomains);
    } else {
      const before=await currentLocation(session);
      assertLocationAllowed(before,allowedDomains);
      assertExpectedDomain(before,expectedDomain(payload,allowedDomains));
      const spec=targetSpec(payload.target);
      if (action === 'read_text') {
        const finder=targetFinderSource(spec);
        const result=await evaluate(session,`(() => {
          ${finder}
          if(matches.length!==1)return {matchCount:matches.length,text:null};
          const el=matches[0];
          return {matchCount:1,text:String(el.innerText||el.textContent||el.value||'').slice(0,4000)};
        })()`);
        if (!result || result.matchCount===0) throw new Error('browser_target_not_found');
        if (result.matchCount!==1) throw new Error('browser_text_target_ambiguous');
        return {success:true,result:{text:String(result.text||'').slice(0,4000)}};
      }
      const snapshot=await elementSnapshot(session,spec);
      assertUnique(snapshot);
      if ((action === 'click' || action === 'submit') && OAUTH_CONSENT_TEXT.test(String(snapshot.text || ''))) {
        throw new Error('browser_oauth_consent_requires_explicit_action');
      }
      if (action === 'oauth_consent' && !OAUTH_CONSENT_TEXT.test(String(snapshot.text || ''))) {
        throw new Error('browser_oauth_consent_target_invalid');
      }
      if (action === 'click' || action === 'oauth_consent') {
        const finder=targetFinderSource(spec);
        const clicked=await evaluate(session,`(() => {
          ${finder}
          if(matches.length!==1)return false;
          const el=matches[0];
          el.scrollIntoView({block:'center',inline:'center'});
          el.click();
          return true;
        })()`);
        if (!clicked) throw new Error('browser_target_not_found');
        await new Promise((resolve)=>setTimeout(resolve,500));
      }
      if (action === 'type') {
        const descriptor=`${snapshot.type} ${snapshot.name} ${snapshot.id} ${snapshot.autocomplete}`;
        if (SENSITIVE_TARGET.test(descriptor)) throw new Error('browser_sensitive_input_requires_human');
        const value=String(payload.value ?? '').slice(0,4000);
        const finder=targetFinderSource(spec);
        const outcome=await evaluate(session,`(() => {
          ${finder}
          if(matches.length!==1)return false;
          const el=matches[0];
          if(!(el instanceof HTMLInputElement||el instanceof HTMLTextAreaElement))return false;
          const proto=el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;
          const descriptor=Object.getOwnPropertyDescriptor(proto,'value');
          if(descriptor?.set)descriptor.set.call(el,${JSON.stringify(value)});else el.value=${JSON.stringify(value)};
          el.dispatchEvent(new Event('input',{bubbles:true}));
          el.dispatchEvent(new Event('change',{bubbles:true}));
          return true;
        })()`);
        if (!outcome) throw new Error('browser_target_not_found');
      }
      if (action === 'submit') {
        const finder=targetFinderSource(spec);
        const submitted=await evaluate(session,`(() => {
          ${finder}
          if(matches.length!==1)return false;
          const el=matches[0];
          const form=el instanceof HTMLFormElement?el:el.closest?.('form');
          if(form&&typeof form.requestSubmit==='function'){
            form.requestSubmit(el instanceof HTMLButtonElement||el instanceof HTMLInputElement?el:undefined);
            return true;
          }
          el.click();
          return true;
        })()`);
        if (!submitted) throw new Error('browser_form_not_found');
        await new Promise((resolve)=>setTimeout(resolve,500));
      }
    }
    const location=await currentLocation(session);
    assertLocationAllowed(location,allowedDomains);
    return {success:true,result:{url:safePublicUrl(location.url),title:String(location.title || '').slice(0,500)}};
  } finally {
    session.close();
  }
}
