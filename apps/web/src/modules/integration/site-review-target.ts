/**
 * ATLAS Site Review: offline URL intake only.
 * Never fetches a target, resolves DNS, tests ownership, or infers site health.
 * Secrets in URL paths/query/fragment are not returned or persisted.
 */
export type PreparedSiteReviewTarget = {
  origin: string;
  hostname: string;
  pathDepth: number;
  queryParameterCount: number;
  fragmentPresent: boolean;
  remoteInspection: 'not_configured';
};

export type SiteReviewTargetResult =
  | { ok: true; target: PreparedSiteReviewTarget }
  | { ok: false; reason: string };

const forbiddenSuffixes = [
  'localhost', 'local', 'internal', 'test', 'invalid', 'example', 'onion', 'lan'
];

export function prepareSiteReviewTarget(input: string): SiteReviewTargetResult {
  const candidate = input.trim();

  if (!candidate || candidate.length > 2048 || /[\u0000-\u001f\u007f]/.test(candidate)) {
    return { ok: false, reason: 'Enter an HTTPS URL with 1–2048 characters and no control characters.' };
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { ok: false, reason: 'Enter a complete URL beginning with https://.' };
  }

  if (url.protocol !== 'https:') {
    return { ok: false, reason: 'Only HTTPS websites can be prepared for review.' };
  }
  if (url.username || url.password) {
    return { ok: false, reason: 'URLs containing credentials are not accepted.' };
  }
  if (url.port) {
    return { ok: false, reason: 'Nonstandard network ports require separate security review.' };
  }

  const hostname = url.hostname.toLowerCase();
  const labels = hostname.split('.');
  const validDnsName = hostname.length <= 253 &&
    labels.length >= 2 &&
    labels.every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));

  const ipLiteral = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) || hostname.startsWith('[');
  const reservedName = forbiddenSuffixes.some(
    (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`)
  );

  if (!validDnsName || ipLiteral || reservedName) {
    return { ok: false, reason: 'Use a public DNS hostname; IP literals and private or reserved domains are excluded.' };
  }

  // Deliberately never expose or persist raw paths, URL query values, or fragments.
  return {
    ok: true,
    target: {
      origin: url.origin,
      hostname,
      pathDepth: url.pathname.split('/').filter(Boolean).length,
      queryParameterCount: Array.from(url.searchParams.keys()).length,
      fragmentPresent: url.hash.length > 0,
      remoteInspection: 'not_configured'
    }
  };
}
