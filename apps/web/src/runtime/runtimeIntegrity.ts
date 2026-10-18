export type RuntimeIncidentCategory =
  | 'application'
  | 'provider'
  | 'network'
  | 'security_policy'
  | 'browser_extension'
  | 'compatibility'
  | 'unknown';

export type RuntimeIncidentSeverity = 'P0' | 'P1' | 'P2' | 'P3';

export type RuntimeEventType =
  | 'react-boundary'
  | 'window-error'
  | 'unhandled-rejection'
  | 'security-policy'
  | 'manual';

export type RuntimeIncidentInput = {
  eventType: RuntimeEventType;
  message: string;
  source?: string | null;
  stack?: string | null;
  route?: string | null;
};

export type RuntimeIncidentClassification = {
  category: RuntimeIncidentCategory;
  severity: RuntimeIncidentSeverity;
  code: string;
};

export type RuntimeIncident = RuntimeIncidentClassification & {
  id: string;
  fingerprint: string;
  eventType: RuntimeEventType;
  message: string;
  source: string | null;
  stack: string | null;
  route: string;
  releaseSha: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  occurrenceCount: number;
};

const STORAGE_KEY = 'atlas.runtime.integrity.v1';
const EVENT_NAME = 'atlas:runtime-integrity';
const MAX_INCIDENTS = 100;
let memoryIncidents: RuntimeIncident[] = [];
let runtimeReleaseSha: string | null = null;

function compactWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

export function sanitizeRuntimeText(value: unknown, maxLength = 1200): string {
  let text = compactWhitespace(String(value ?? ''));

  text = text
    .replace(/(bearer\s+)[^\s"'&,;]+/gi, '$1[REDACTED]')
    .replace(/(\b(?:authorization|token|api[_-]?key|access[_-]?token)\b\s*[:=]\s*)[^\s"'&,;]+/gi, '$1[REDACTED]')
    .replace(/([?&](?:token|key|secret|code)=)[^&#\s]+/gi, '$1[REDACTED]');

  return text.slice(0, maxLength);
}

function sanitizeSource(value: unknown): string | null {
  const source = sanitizeRuntimeText(value, 500);
  if (!source) return null;

  try {
    const url = new URL(source, typeof window !== 'undefined' ? window.location.origin : 'https://atlas.invalid');
    url.search = '';
    url.hash = '';
    return url.toString().slice(0, 500);
  } catch {
    return source;
  }
}

export function classifyRuntimeIncident(input: RuntimeIncidentInput): RuntimeIncidentClassification {
  const message = `${input.message || ''} ${input.source || ''}`.toLowerCase();

  if (
    message.includes('chrome-extension://')
    || message.includes('moz-extension://')
    || message.includes('runtime.lasterror')
    || message.includes('receiving end does not exist')
  ) {
    return {
      category: 'browser_extension',
      severity: 'P3',
      code: 'browser_extension_transport'
    };
  }

  if (
    input.eventType === 'security-policy'
    || message.includes('permissions policy')
    || message.includes('content security policy')
    || message.includes('securitypolicyviolation')
  ) {
    return {
      category: 'security_policy',
      severity: 'P2',
      code: 'permissions_policy_violation'
    };
  }

  if (input.eventType === 'react-boundary') {
    return {
      category: 'application',
      severity: 'P0',
      code: 'react_render_failure'
    };
  }

  if (
    message.includes('failed to fetch')
    || message.includes('networkerror')
    || message.includes('load failed')
    || message.includes('network request failed')
  ) {
    return {
      category: 'network',
      severity: input.eventType === 'unhandled-rejection' ? 'P1' : 'P2',
      code: 'network_runtime_failure'
    };
  }

  if (
    message.includes('supabase')
    || message.includes('cloudflare')
    || message.includes('provider unavailable')
    || message.includes('provider_error')
  ) {
    return {
      category: 'provider',
      severity: 'P1',
      code: 'provider_runtime_failure'
    };
  }

  if (
    message.includes('-webkit-')
    || message.includes('deprecated')
    || message.includes('unsupported css')
  ) {
    return {
      category: 'compatibility',
      severity: 'P3',
      code: 'browser_compatibility_warning'
    };
  }

  if (input.eventType === 'unhandled-rejection') {
    return {
      category: 'application',
      severity: 'P1',
      code: 'unhandled_promise_rejection'
    };
  }

  if (input.eventType === 'window-error') {
    return {
      category: 'application',
      severity: 'P1',
      code: 'uncaught_application_error'
    };
  }

  return {
    category: 'unknown',
    severity: 'P2',
    code: 'unclassified_runtime_event'
  };
}

function hashFingerprint(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function readStoredIncidents(): RuntimeIncident[] {
  if (typeof window === 'undefined') return memoryIncidents;

  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.slice(0, MAX_INCIDENTS) : [];
  } catch {
    return memoryIncidents;
  }
}

function writeStoredIncidents(incidents: RuntimeIncident[]) {
  memoryIncidents = incidents.slice(0, MAX_INCIDENTS);
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(memoryIncidents));
  } catch {
    // Runtime diagnostics must never crash the application they are observing.
  }
}

export function getRuntimeIncidents(): RuntimeIncident[] {
  return readStoredIncidents();
}

export function clearRuntimeIncidents() {
  writeStoredIncidents([]);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  }
}

export function setRuntimeReleaseSha(value: unknown) {
  const candidate = String(value || '').trim();
  runtimeReleaseSha = /^[0-9a-f]{40}$/i.test(candidate) ? candidate.toLowerCase() : null;
}

export function getRuntimeReleaseSha() {
  return runtimeReleaseSha;
}

export async function hydrateRuntimeReleaseMetadata(): Promise<string | null> {
  if (runtimeReleaseSha) return runtimeReleaseSha;
  if (typeof window === 'undefined') return null;

  try {
    const response = await fetch('/deployment.json', {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
      headers: { accept: 'application/json' }
    });

    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return null;

    const body = await response.json().catch(() => null) as { commit_sha?: unknown } | null;
    setRuntimeReleaseSha(body?.commit_sha);
    return runtimeReleaseSha;
  } catch {
    return null;
  }
}

function incidentRoute(input: RuntimeIncidentInput) {
  if (input.route) return sanitizeRuntimeText(input.route, 500);
  if (typeof window !== 'undefined') return sanitizeRuntimeText(window.location.pathname, 500) || '/';
  return '/';
}

export function recordRuntimeIncident(input: RuntimeIncidentInput): RuntimeIncident {
  const classification = classifyRuntimeIncident(input);
  const message = sanitizeRuntimeText(input.message || 'Unknown runtime error');
  const source = sanitizeSource(input.source);
  const stack = input.stack ? sanitizeRuntimeText(input.stack, 2400) : null;
  const route = incidentRoute(input);
  const fingerprint = hashFingerprint([
    classification.code,
    input.eventType,
    route,
    message,
    source || ''
  ].join('|'));
  const now = new Date().toISOString();

  const incidents = readStoredIncidents();
  const existingIndex = incidents.findIndex((item) => item.fingerprint === fingerprint);

  let incident: RuntimeIncident;
  if (existingIndex >= 0) {
    incident = {
      ...incidents[existingIndex],
      lastSeenAt: now,
      occurrenceCount: incidents[existingIndex].occurrenceCount + 1,
      releaseSha: runtimeReleaseSha || incidents[existingIndex].releaseSha
    };
    incidents.splice(existingIndex, 1);
  } else {
    incident = {
      id: `${fingerprint}-${Date.now().toString(36)}`,
      fingerprint,
      ...classification,
      eventType: input.eventType,
      message,
      source,
      stack,
      route,
      releaseSha: runtimeReleaseSha,
      firstSeenAt: now,
      lastSeenAt: now,
      occurrenceCount: 1
    };
  }

  writeStoredIncidents([incident, ...incidents].slice(0, MAX_INCIDENTS));

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: incident }));
  }

  return incident;
}

function reasonToError(reason: unknown) {
  if (reason instanceof Error) {
    return {
      message: reason.message,
      stack: reason.stack || null
    };
  }

  if (typeof reason === 'string') return { message: reason, stack: null };

  try {
    return { message: JSON.stringify(reason), stack: null };
  } catch {
    return { message: String(reason), stack: null };
  }
}

export function installRuntimeIntegrityListeners() {
  if (typeof window === 'undefined') return () => {};

  const onError = (event: ErrorEvent) => {
    recordRuntimeIncident({
      eventType: 'window-error',
      message: event.message || event.error?.message || 'Uncaught browser error',
      source: event.filename || null,
      stack: event.error instanceof Error ? event.error.stack || null : null
    });
  };

  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = reasonToError(event.reason);
    recordRuntimeIncident({
      eventType: 'unhandled-rejection',
      message: reason.message || 'Unhandled promise rejection',
      stack: reason.stack
    });
  };

  const onSecurityPolicyViolation = (event: SecurityPolicyViolationEvent) => {
    recordRuntimeIncident({
      eventType: 'security-policy',
      message: [
        'Security policy violation',
        event.effectiveDirective || event.violatedDirective,
        event.disposition
      ].filter(Boolean).join(': '),
      source: event.blockedURI || event.sourceFile || null
    });
  };

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onUnhandledRejection);
  window.addEventListener('securitypolicyviolation', onSecurityPolicyViolation);

  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onUnhandledRejection);
    window.removeEventListener('securitypolicyviolation', onSecurityPolicyViolation);
  };
}

export function subscribeRuntimeIncidents(listener: () => void) {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
}
