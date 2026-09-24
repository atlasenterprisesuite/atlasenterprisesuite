export type AtlasCopilotShellVerification =
  | { ok: true; reason: null }
  | { ok: false; reason: 'http_status' | 'content_type' | 'body_not_html' };

function looksLikeHtml(body: string): boolean {
  const normalized = String(body ?? '').trimStart().toLowerCase();
  return normalized.startsWith('<!doctype html') || normalized.startsWith('<html');
}

export function verifyAtlasCopilotShell(input: {
  status: number;
  contentType: string | null;
  body: string;
}): AtlasCopilotShellVerification {
  if (input.status !== 200) {
    return { ok: false, reason: 'http_status' };
  }

  const contentType = String(input.contentType ?? '').toLowerCase();
  if (contentType.includes('text/html')) {
    return { ok: true, reason: null };
  }

  // Supabase Edge Functions intentionally rewrite GET text/html responses to
  // text/plain. Accept that platform behavior only when the response body is
  // unmistakably an HTML document; arbitrary text/plain must still fail closed.
  if (contentType.includes('text/plain')) {
    return looksLikeHtml(input.body)
      ? { ok: true, reason: null }
      : { ok: false, reason: 'body_not_html' };
  }

  return { ok: false, reason: 'content_type' };
}
