export function creatorError(code: string, status = 400, details: Record<string, unknown> = {}) {
  return Object.assign(new Error(code), { code, status, ...details });
}

export function creatorErrorResponse(error: unknown) {
  const value = error as { code?: string; status?: number };
  return new Response(JSON.stringify({ ok: false, error: value.code || 'internal_error' }), {
    status: value.status || 500,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}
