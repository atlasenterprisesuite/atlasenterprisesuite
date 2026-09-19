#!/usr/bin/env node
const EXECUTION_URL = String(
  process.env.ATLAS_EXECUTION_URL ||
  'https://ggmanzcgtlrvqfoccgsh.supabase.co/functions/v1/atlas-execution'
).trim();
const RUNTIME_ID = String(process.env.ATLAS_WORK_RUNTIME_ID || '').trim();
const RUNTIME_TOKEN = String(process.env.ATLAS_WORK_RUNTIME_TOKEN || '').trim();
const CDP_HTTP_URL = String(process.env.ATLAS_BROWSER_CDP_URL || 'http://127.0.0.1:9222').trim();
const HEARTBEAT_MS = 30_000;
const POLL_MS = Math.min(Math.max(Number(process.env.ATLAS_BROWSER_POLL_MS || 2000), 1000), 30_000);
const ACTION_TIMEOUT_MS = 15_000;
const SENSITIVE_KEY = /token|secret|password|cookie|authorization|credential|recovery|private.?key/i;
const SENSITIVE_INPUT = /password|passcode|secret|token|otp|one.?time|verification.?code|cvc|cvv|credit.?card/i;
const OAUTH_CONSENT_TEXT = /\b(authorize|allow|grant|choose account|connect(?: app)?|approve|consent)\b/i;
const SUPPORTED_ACTIONS = new Set(['navigate', 'read_text', 'click', 'type', 'submit', 'oauth_consent', 'click_openai_check']);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeUrl(value) {
  try {
    const url = new URL(String(value || ''));
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    return url.toString().slice(0, 2000);
  } catch {
    return '[redacted-url]';
  }
}

function sanitize(value, depth = 0) {
  if (depth > 8) return '[depth-limited]';
  if (typeof value === 'string') return value.slice(0, 2000);
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitize(item, depth + 1));
  if (value && typeof value === 'object') {
    const output = {};
    for (const [key, nested] of Object.entries(value).slice(0, 100)) {
      if (SENSITIVE_KEY.test(key)) continue;
      if (/^(url|uri|href)$/i.test(key)) {
        output[key] = safeUrl(nested);
        continue;
      }
      output[key] = sanitize(nested, depth + 1);
    }
    return output;
  }
  return String(value ?? '').slice(0, 2000);
}

function normalizeHostname(value) {
  return String(value || '').trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].replace(/\.$/, '');
}

function domainAllowed(domain, allowed) {
  const current = normalizeHostname(domain);
  const candidate = normalizeHostname(allowed);
  return current === candidate || current.endsWith(`.${candidate}`);
}

function evaluateEnvelope(envelope, action) {
  if (!envelope || typeof envelope !== 'object') return { allowed: false, reason: 'execution_envelope_required' };
  const expiry = Date.parse(String(envelope.expiresAt || envelope.expires_at || ''));
  if (!Number.isFinite(expiry) || Date.now() >= expiry) return { allowed: false, reason: 'execution_envelope_expired' };

  const type = String(action?.type || '').trim();
  const domain = normalizeHostname(action?.domain);
  const allowedActions = Array.isArray(envelope.allowedActions) ? envelope.allowedActions.map(String) :
    Array.isArray(envelope.allowed_actions) ? envelope.allowed_actions.map(String) : [];
  const deniedActions = Array.isArray(envelope.deniedActions) ? envelope.deniedActions.map(String) :
    Array.isArray(envelope.denied_actions) ? envelope.denied_actions.map(String) : [];
  const allowedDomains = Array.isArray(envelope.allowedDomains) ? envelope.allowedDomains.map(String) :
    Array.isArray(envelope.allowed_domains) ? envelope.allowed_domains.map(String) : [];

  if (!SUPPORTED_ACTIONS.has(type)) return { allowed: false, reason: 'browser_action_unsupported' };
  if (deniedActions.includes(type)) return { allowed: false, reason: 'browser_action_explicitly_denied' };
  if (!allowedActions.includes(type)) return { allowed: false, reason: 'browser_action_not_allowed' };
  if (!domain || !allowedDomains.some((allowed) => domainAllowed(domain, allowed))) {
    return { allowed: false, reason: 'browser_domain_not_allowed' };
  }
  return { allowed: true, reason: 'browser_action_allowed' };
}

function assertLoopbackCdp(raw) {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('browser_cdp_url_invalid');
  }
  const host = url.hostname.replace(/^\[/, '').replace(/\]$/, '').toLowerCase();
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) throw new Error('browser_cdp_must_be_loopback');
  return url;
}

function selector(value) {
  const result = String(value || '').trim();
  if (!result || result.length > 1000 || /[\u0000-\u001f]/.test(result)) throw new Error('browser_selector_invalid');
  return result;
}

async function executionPost(operation, body = {}) {
  const response = await fetch(EXECUTION_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${RUNTIME_TOKEN}`,
      'x-atlas-runtime-id': RUNTIME_ID
    },
    body: JSON.stringify({ operation, ...body }),
    signal: AbortSignal.timeout(15_000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok !== true) {
    const error = new Error(String(data.error || `atlas_execution_http_${response.status}`));
    error.status = response.status;
    throw error;
  }
  return data;
}

class CdpClient {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.ws = ws;
      const timer = setTimeout(() => {
        try { ws.close(); } catch {}
        reject(new Error('cdp_connect_timeout'));
      }, ACTION_TIMEOUT_MS);
      ws.addEventListener('open', () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
      ws.addEventListener('error', () => {
        clearTimeout(timer);
        reject(new Error('cdp_connect_failed'));
      }, { once: true });
      ws.addEventListener('message', (event) => {
        let message;
        try { message = JSON.parse(String(event.data || '')); } catch { return; }
        if (!message?.id) return;
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(`cdp_${String(message.error.message || 'command_failed')}`));
        else pending.resolve(message.result || {});
      });
      ws.addEventListener('close', () => {
        for (const pending of this.pending.values()) pending.reject(new Error('cdp_connection_closed'));
        this.pending.clear();
      });
    });
    await this.send('Page.enable');
    await this.send('Runtime.enable');
  }

  send(method, params = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return Promise.reject(new Error('cdp_not_connected'));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error('cdp_command_timeout'));
      }, ACTION_TIMEOUT_MS);
      this.pending.set(id, {
        resolve: (value) => { clearTimeout(timer); resolve(value); },
        reject: (error) => { clearTimeout(timer); reject(error); }
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
      userGesture: true
    });
    if (result.exceptionDetails) throw new Error('browser_dom_action_failed');
    return result.result?.value;
  }

  close() {
    try { this.ws?.close(); } catch {}
  }
}

async function pageTarget(cdpBase) {
  const listUrl = new URL('/json/list', cdpBase);
  let targets = await fetch(listUrl, { signal: AbortSignal.timeout(5000) }).then((response) => response.json());
  let page = Array.isArray(targets) ? targets.find((target) => target?.type === 'page' && target?.webSocketDebuggerUrl) : null;
  if (!page) {
    const createUrl = new URL('/json/new?about:blank', cdpBase);
    await fetch(createUrl, { method: 'PUT', signal: AbortSignal.timeout(5000) });
    targets = await fetch(listUrl, { signal: AbortSignal.timeout(5000) }).then((response) => response.json());
    page = Array.isArray(targets) ? targets.find((target) => target?.type === 'page' && target?.webSocketDebuggerUrl) : null;
  }
  if (!page?.webSocketDebuggerUrl) throw new Error('browser_page_target_unavailable');
  return page;
}

async function withPage(fn) {
  const base = assertLoopbackCdp(CDP_HTTP_URL);
  const target = await pageTarget(base);
  const client = new CdpClient(String(target.webSocketDebuggerUrl));
  await client.connect();
  try {
    return await fn(client);
  } finally {
    client.close();
  }
}

async function currentPage(client) {
  return await client.evaluate(`(() => ({
    url: location.href,
    domain: location.hostname,
    title: document.title
  }))()`);
}

function assertPageDomain(page, action) {
  const expected = normalizeHostname(action.domain);
  const actual = normalizeHostname(page?.domain);
  if (!expected || !actual || !domainAllowed(actual, expected)) throw new Error('browser_page_domain_mismatch');
}

async function navigate(client, action) {
  const url = new URL(String(action.target || ''));
  if (url.protocol !== 'https:' || url.username || url.password || normalizeHostname(url.hostname) !== normalizeHostname(action.domain)) {
    throw new Error('browser_navigation_target_denied');
  }
  await client.send('Page.navigate', { url: url.toString() });
  await sleep(700);
  const page = await currentPage(client);
  assertPageDomain(page, action);
  return { url: page.url, domain: page.domain, title: page.title };
}

async function readText(client, action) {
  const page = await currentPage(client);
  assertPageDomain(page, action);
  const target = action.target ? selector(action.target) : null;
  const targetJson = JSON.stringify(target);
  return await client.evaluate(`(() => {
    const selector = ${targetJson};
    const node = selector ? document.querySelector(selector) : document.body;
    if (!node) throw new Error('target_not_found');
    return {
      url: location.href,
      domain: location.hostname,
      title: document.title,
      text: String(node.innerText || node.textContent || '').slice(0, 20000)
    };
  })()`);
}

async function elementSnapshot(client, css) {
  const cssJson = JSON.stringify(css);
  return await client.evaluate(`(() => {
    const el = document.querySelector(${cssJson});
    if (!el) return null;
    const input = el;
    return {
      tag: String(el.tagName || '').toLowerCase(),
      type: String(input.type || '').toLowerCase(),
      name: String(input.name || ''),
      id: String(el.id || ''),
      autocomplete: String(input.autocomplete || ''),
      text: String(el.innerText || el.textContent || input.value || '').trim().slice(0, 500),
      disabled: Boolean(input.disabled),
      ariaDisabled: el.getAttribute('aria-disabled') === 'true'
    };
  })()`);
}

async function click(client, action, consent = false) {
  const page = await currentPage(client);
  assertPageDomain(page, action);
  const css = selector(action.target);
  const snapshot = await elementSnapshot(client, css);
  if (!snapshot) throw new Error('browser_target_not_found');
  if (snapshot.disabled || snapshot.ariaDisabled) throw new Error('browser_target_disabled');
  if (!consent && OAUTH_CONSENT_TEXT.test(String(snapshot.text || ''))) {
    return {
      state: 'waiting_human',
      result: { reason: 'oauth_consent_requires_approved_action', targetText: snapshot.text, url: page.url }
    };
  }
  const cssJson = JSON.stringify(css);
  await client.evaluate(`(() => {
    const el = document.querySelector(${cssJson});
    if (!el) throw new Error('target_not_found');
    el.scrollIntoView({ block: 'center', inline: 'center' });
    el.click();
    return true;
  })()`);
  await sleep(500);
  const after = await currentPage(client);
  return { state: 'completed', result: { clicked: true, url: after.url, domain: after.domain, title: after.title } };
}

async function typeValue(client, action) {
  const page = await currentPage(client);
  assertPageDomain(page, action);
  const css = selector(action.target);
  const snapshot = await elementSnapshot(client, css);
  if (!snapshot) throw new Error('browser_target_not_found');
  const sensitiveDescriptor = `${snapshot.type} ${snapshot.name} ${snapshot.id} ${snapshot.autocomplete}`;
  if (SENSITIVE_INPUT.test(sensitiveDescriptor)) throw new Error('browser_sensitive_input_denied');
  if (action.value === undefined || String(action.value).length > 4000) throw new Error('browser_type_value_invalid');
  const cssJson = JSON.stringify(css);
  const valueJson = JSON.stringify(String(action.value));
  await client.evaluate(`(() => {
    const el = document.querySelector(${cssJson});
    if (!el) throw new Error('target_not_found');
    const value = ${valueJson};
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
    if (descriptor?.set) descriptor.set.call(el, value); else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  return { state: 'completed', result: { typed: true, characters: String(action.value).length, url: page.url } };
}

async function submit(client, action) {
  const page = await currentPage(client);
  assertPageDomain(page, action);
  const css = selector(action.target);
  const snapshot = await elementSnapshot(client, css);
  if (!snapshot) throw new Error('browser_target_not_found');
  if (OAUTH_CONSENT_TEXT.test(String(snapshot.text || ''))) {
    return { state: 'waiting_human', result: { reason: 'oauth_consent_requires_approved_action', targetText: snapshot.text, url: page.url } };
  }
  const cssJson = JSON.stringify(css);
  await client.evaluate(`(() => {
    const el = document.querySelector(${cssJson});
    if (!el) throw new Error('target_not_found');
    if (el instanceof HTMLFormElement) el.requestSubmit();
    else {
      const form = el.closest('form');
      if (form) form.requestSubmit(el instanceof HTMLButtonElement || el instanceof HTMLInputElement ? el : undefined);
      else el.click();
    }
    return true;
  })()`);
  return { state: 'completed', result: { submitted: true, url: page.url } };
}

async function executeJob(job) {
  const envelope = job?.execution_envelope || {};
  const action = job?.action || {};
  const decision = evaluateEnvelope(envelope, action);
  if (!decision.allowed) return { state: 'failed', result: { error: decision.reason } };

  try {
    return await withPage(async (client) => {
      if (action.type === 'navigate') return { state: 'completed', result: await navigate(client, action) };
      if (action.type === 'read_text') return { state: 'completed', result: await readText(client, action) };
      if (action.type === 'type') return await typeValue(client, action);
      if (action.type === 'click') return await click(client, action, false);
      if (action.type === 'submit') return await submit(client, action);
      if (action.type === 'oauth_consent') return await click(client, action, true);
      if (action.type === 'click_openai_check') return await click(client, action, false);
      return { state: 'failed', result: { error: 'browser_action_unsupported' } };
    });
  } catch (error) {
    return { state: 'failed', result: { error: String(error?.message || 'browser_action_failed').slice(0, 160) } };
  }
}

async function heartbeat() {
  await executionPost('heartbeat_work_runtime');
}

async function claimOnce() {
  const { job } = await executionPost('claim_work_runtime_job');
  if (!job) return false;
  const outcome = await executeJob(job);
  await executionPost('complete_work_runtime_job', {
    job_id: job.id,
    lease_id: job.lease_id,
    state: outcome.state,
    result: sanitize(outcome.result)
  });
  return true;
}

async function main() {
  if (!RUNTIME_ID || !RUNTIME_TOKEN) throw new Error('atlas_work_runtime_credentials_required');
  assertLoopbackCdp(CDP_HTTP_URL);
  await heartbeat();
  setInterval(() => heartbeat().catch((error) => {
    if (error?.status === 401) process.stderr.write('ATLAS Browser Runtime authentication expired or was revoked.\n');
  }), HEARTBEAT_MS);

  process.stdout.write('ATLAS Governed Browser Runtime online. CDP is loopback-only; actions are envelope-scoped.\n');
  while (true) {
    try {
      let worked = false;
      for (let count = 0; count < 10; count += 1) {
        if (!await claimOnce()) break;
        worked = true;
      }
      if (!worked) await sleep(POLL_MS);
    } catch (error) {
      if (error?.status === 401) throw error;
      await sleep(POLL_MS);
    }
  }
}

main().catch((error) => {
  process.stderr.write(`ATLAS Governed Browser Runtime stopped: ${String(error?.message || 'runtime_error')}\n`);
  process.exitCode = 1;
});
