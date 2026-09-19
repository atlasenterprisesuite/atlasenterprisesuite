import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DEFAULT_PORT = 9222;
const DEFAULT_ALLOWED_ACTIONS = new Set(['navigate','read_text','click','type','submit']);
const SENSITIVE_TARGET = /password|passwd|secret|token|otp|mfa|2fa|credit.?card|cvv|cvc|ssn|social.?security/i;

function normalizeHostname(value) {
  return String(value || '').trim().toLowerCase().replace(/^https?:\/\//,'').split('/')[0].replace(/\.$/,'');
}

export function browserDomainAllowed(domain, allowedDomains) {
  const hostname = normalizeHostname(domain);
  return Boolean(hostname) && allowedDomains.some((allowed) => {
    const candidate = normalizeHostname(allowed);
    return hostname === candidate || hostname.endsWith('.' + candidate);
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
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    ];
  }
  if (process.platform === 'win32') {
    const roots = [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean);
    return roots.flatMap((root) => [
      join(root,'Google','Chrome','Application','chrome.exe'),
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
  await mkdir(profile,{recursive:true});
  const args = [
    '--remote-debugging-address=127.0.0.1',
    '--remote-debugging-port=' + port,
    '--user-data-dir=' + profile,
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank'
  ];
  if (String(process.env.ATLAS_BROWSER_HEADLESS || '').toLowerCase() === 'true') {
    args.unshift('--headless=new');
  }
  const child = spawn(resolveExecutable(),args,{detached:true,stdio:'ignore'});
  child.unref();
  for (let attempt=0; attempt<20; attempt+=1) {
    await new Promise((resolve)=>setTimeout(resolve,250));
    try {
      await versionEndpoint(port);
      return;
    } catch {}
  }
  throw new Error('browser_cdp_start_failed');
}

export async function startBrowserSession() {
  const port = operatorPort();
  try {
    await versionEndpoint(port);
    return { port, alreadyRunning: true };
  } catch {}
  await launchBrowser(port);
  return { port, alreadyRunning: false };
}

async function ensureBrowser() {
  const port = operatorPort();
  try {
    await versionEndpoint(port);
  } catch {
    if (String(process.env.ATLAS_BROWSER_ALLOW_SERVICE_LAUNCH || '').toLowerCase() !== 'true') {
      throw new Error('browser_session_not_running');
    }
    await launchBrowser(port);
  }
  return port;
}

async function pageTarget(port) {
  const response = await fetch('http://127.0.0.1:' + port + '/json/list', {
    cache:'no-store',
    signal:AbortSignal.timeout(2000)
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
    this.socket = null;
  }

  async connect() {
    this.socket = new WebSocket(this.url);
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('browser_cdp_connect_timeout')),3000);
      this.socket.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});
      this.socket.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('browser_cdp_connect_failed'));},{once:true});
    });
    this.socket.addEventListener('message',(event)=>{
      let message;
      try { message=JSON.parse(String(event.data || '')); } catch { return; }
      if (!message?.id) return;
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
      },8000);
      this.pending.set(id,{
        resolve:(value)=>{clearTimeout(timer);resolve(value);},
        reject:(error)=>{clearTimeout(timer);reject(error);}
      });
      this.socket.send(JSON.stringify({id,method,params}));
    });
  }

  close() {
    try { this.socket?.close(); } catch {}
  }
}

function targetExpression(target) {
  const serialized=JSON.stringify(String(target || ''));
  return '(() => {' +
    'const target=' + serialized + ';' +
    'if(!target)return document.activeElement||document.body;' +
    'if(target.startsWith("text=")){' +
      'const needle=target.slice(5).trim().toLowerCase();' +
      'return [...document.querySelectorAll("button,a,[role=button],input[type=button],input[type=submit],label")]' +
        '.find((el)=>String(el.innerText||el.value||el.textContent||"").trim().toLowerCase().includes(needle))||null;' +
    '}' +
    'try{return document.querySelector(target);}catch{return null;}' +
  '})()';
}

async function evaluate(session,expression) {
  const result=await session.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if (result?.exceptionDetails) throw new Error('browser_script_failed');
  return result?.result?.value;
}

async function currentLocation(session) {
  return evaluate(session,'({url:location.href,title:document.title})');
}

function assertLocationAllowed(location,allowedDomains) {
  let url;
  try { url=new URL(String(location?.url || '')); } catch { throw new Error('browser_location_invalid'); }
  if (!browserDomainAllowed(url.hostname,allowedDomains)) throw new Error('browser_domain_not_allowed');
}

export function validateBrowserCommand(action,payload,allowedDomains) {
  if (!DEFAULT_ALLOWED_ACTIONS.has(action)) throw new Error('browser_action_not_supported');
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('browser_action_payload_invalid');
  if (JSON.stringify(payload).length > 8000) throw new Error('browser_action_payload_too_large');
  if (action === 'navigate') {
    let url;
    try { url=new URL(String(payload.url || '')); } catch { throw new Error('browser_navigation_url_invalid'); }
    if (!['https:','http:'].includes(url.protocol) || !browserDomainAllowed(url.hostname,allowedDomains)) {
      throw new Error('browser_domain_not_allowed');
    }
  }
  if (action === 'type' && SENSITIVE_TARGET.test(String(payload.target || ''))) {
    throw new Error('browser_sensitive_input_requires_human');
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
    } else {
      const before=await currentLocation(session);
      assertLocationAllowed(before,allowedDomains);

      if (action === 'read_text') {
        const expression='(() => {const el=' + targetExpression(payload.target) + ';return el?String(el.innerText||el.textContent||el.value||"").slice(0,4000):null;})()';
        const text=await evaluate(session,expression);
        if (text === null) throw new Error('browser_target_not_found');
        return {success:true,result:{text}};
      }

      if (action === 'click') {
        const expression='(() => {const el=' + targetExpression(payload.target) + ';if(!el)return false;el.scrollIntoView({block:"center",inline:"center"});el.click();return true;})()';
        if (!await evaluate(session,expression)) throw new Error('browser_target_not_found');
        await new Promise((resolve)=>setTimeout(resolve,500));
      }

      if (action === 'type') {
        const value=String(payload.value ?? '').slice(0,4000);
        const expression='(() => {const el=' + targetExpression(payload.target) + ';if(!el||!(el instanceof HTMLElement))return false;' +
          'if(el instanceof HTMLInputElement&&String(el.type||"").toLowerCase()==="password")return "sensitive";' +
          'el.focus();if("value" in el)el.value=' + JSON.stringify(value) + ';else el.textContent=' + JSON.stringify(value) + ';' +
          'el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}));return true;})()';
        const outcome=await evaluate(session,expression);
        if (outcome === 'sensitive') throw new Error('browser_sensitive_input_requires_human');
        if (!outcome) throw new Error('browser_target_not_found');
      }

      if (action === 'submit') {
        const expression='(() => {const el=' + targetExpression(payload.target) + ';const form=el instanceof HTMLFormElement?el:el?.closest?.("form")||document.activeElement?.closest?.("form");' +
          'if(!form)return false;if(typeof form.requestSubmit==="function")form.requestSubmit();else form.submit();return true;})()';
        if (!await evaluate(session,expression)) throw new Error('browser_form_not_found');
        await new Promise((resolve)=>setTimeout(resolve,500));
      }
    }

    const location=await currentLocation(session);
    assertLocationAllowed(location,allowedDomains);
    return {success:true,result:{url:String(location.url || '').slice(0,1500),title:String(location.title || '').slice(0,500)}};
  } finally {
    session.close();
  }
}
