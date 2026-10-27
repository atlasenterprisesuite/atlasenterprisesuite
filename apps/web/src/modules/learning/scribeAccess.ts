/** Scribe documentation access gate. No provider token or private URL is accepted. */
export type ScribeGuide = Readonly<{
  id: string;
  organizationId: string;
  title: string;
  url: string;
  visibility: 'public' | 'organization';
  enabled: boolean;
}>;
export type ScribeViewer = Readonly<{
  authenticated: boolean;
  organizationId: string | null;
  roles: readonly string[];
  consentToExternalContent: boolean;
}>;
export type ScribeAccessResult =
  | { allowed: true; embedUrl: string }
  | { allowed: false; reason: 'invalid_url' | 'unauthenticated' | 'tenant_mismatch' | 'forbidden' | 'consent_required' | 'disabled' };

export function authorizeScribeGuide(guide: ScribeGuide, viewer: ScribeViewer): ScribeAccessResult {
  if (!guide.enabled) return { allowed: false, reason: 'disabled' };
  let url: URL;
  try { url = new URL(guide.url); } catch { return { allowed: false, reason: 'invalid_url' }; }
  if (url.protocol !== 'https:' || url.hostname !== 'scribehow.com' ||
      url.username || url.password || url.port || url.search || url.hash ||
      !/^\\/(?:shared|embed)\\/[a-zA-Z0-9_-]+\\/?$/.test(url.pathname)) {
    return { allowed: false, reason: 'invalid_url' };
  }
  if (!viewer.authenticated) return { allowed: false, reason: 'unauthenticated' };
  if (!viewer.organizationId || viewer.organizationId !== guide.organizationId)
    return { allowed: false, reason: 'tenant_mismatch' };
  if (!viewer.roles.some(role => role === 'owner' || role === 'admin' || role === 'member' || role === 'viewer'))
    return { allowed: false, reason: 'forbidden' };
  if (!viewer.consentToExternalContent) return { allowed: false, reason: 'consent_required' };
  return { allowed: true, embedUrl: url.toString() };
}
