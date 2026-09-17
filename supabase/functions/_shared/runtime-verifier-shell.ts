export type AtlasCopilotShellVerification =
  | { ok: true; reason: null }
  | { ok: false; reason: 'http_status' | 'content_type' };

export function verifyAtlasCopilotShell(input: {
  status: number;
  contentType: string | null;
  body: string;
}): AtlasCopilotShellVerification {
  if (input.status !== 200) {
    return { ok: false, reason: 'http_status' };
  }

  const contentType = String(input.contentType ?? '').toLowerCase();
  if (!contentType.includes('text/html')) {
    return { ok: false, reason: 'content_type' };
  }

  return { ok: true, reason: null };
}
