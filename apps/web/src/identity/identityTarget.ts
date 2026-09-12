const DEFAULT_TARGET = '/app';

const SUPPORTED_PREFIXES = [
  '/app',
  '/finance',
  '/health',
  '/people',
  '/operations',
  '/automations',
  '/site-review',
  '/spatial',
  '/release',
  '/voice',
  '/studio',
  '/telecom',
] as const;

export function resolveAtlasIdentityTarget(rawTarget: string | null) {
  if (!rawTarget) return DEFAULT_TARGET;

  let target = rawTarget.trim();
  try {
    target = decodeURIComponent(target);
  } catch {
    return DEFAULT_TARGET;
  }

  if (!target.startsWith('/') || target.startsWith('//') || target.includes('\\')) {
    return DEFAULT_TARGET;
  }

  const pathname = target.split(/[?#]/, 1)[0];
  if (pathname === '/identity' || pathname.startsWith('/identity/')) {
    return DEFAULT_TARGET;
  }

  if (SUPPORTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return target;
  }

  return DEFAULT_TARGET;
}
