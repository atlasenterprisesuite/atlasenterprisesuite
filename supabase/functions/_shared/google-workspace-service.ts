import { verifyGoogleOAuthState, sha256Base64Url } from "./google-oauth.ts";
import type { GoogleOAuthStatePayload } from "./google-oauth.ts";
import { previewGoogleSheetTransactions } from "../../../packages/core/src/google-sheets-preview.ts";
import { sealCredential } from "./integration-credential-vault.ts";
import type {
  ProviderCredentialPayload,
  SealedCredential,
} from "./integration-credential-vault.ts";

export type WorkspaceActor = { userId: string; organizationId: string };
export type WorkspaceRequest = { action: string; [key: string]: unknown };
export type WorkspaceDependencies = {
  stateSecret: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  credentialKey: string | Uint8Array;
  pickerApiKey: string;
  pickerAppId: string;
  authorize: (org: string, permission: string) => Promise<boolean>;
  claimState: (
    payload: GoogleOAuthStatePayload,
    nonceHash: string,
  ) => Promise<boolean>;
  saveCredential: (
    actor: WorkspaceActor,
    sealed: SealedCredential,
    credential: ProviderCredentialPayload,
  ) => Promise<void>;
  loadCredential: (
    actor: WorkspaceActor,
  ) => Promise<ProviderCredentialPayload | null>;
  disconnect: (actor: WorkspaceActor) => Promise<void>;
  commitDrafts: (input: {
    actor: WorkspaceActor;
    fileId: string;
    sheetTitle: string;
    rows: ReturnType<typeof previewGoogleSheetTransactions>["rows"];
    debitAccountId: string;
    creditAccountId: string;
  }) => Promise<unknown>;
  fetchImpl?: typeof fetch;
};
const FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";
function text(value: unknown, name: string, max = 256): string {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new Error(`invalid_${name}`);
  return value.trim();
}
/** Bounded response parsing; fixed provider origins, no redirects, no automatic mutations on retries. */
async function googleJson(
  deps: WorkspaceDependencies,
  url: string,
  init: RequestInit = {},
): Promise<any> {
  let response: Response;
  try {
    response = await (deps.fetchImpl ?? fetch)(url, {
      ...init,
      redirect: "error",
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error("google_unavailable");
  }
  if (!response.ok)
    throw new Error(
      response.status === 429
        ? "google_rate_limited"
        : response.status === 401
          ? "google_reauthorization_required"
          : "google_request_failed",
    );
  const reader = response.body?.getReader();
  if (!reader) throw new Error("google_invalid_response");
  const decoder = new TextDecoder();
  let body = "",
    bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 2_000_000) {
        await reader.cancel();
        throw new Error("google_response_too_large");
      }
      body += decoder.decode(value, { stream: true });
    }
    return JSON.parse(body + decoder.decode());
  } catch (error) {
    if (error instanceof Error && error.message === "google_response_too_large")
      throw error;
    throw new Error("google_invalid_response");
  } finally {
    reader.releaseLock();
  }
}

export async function runGoogleWorkspaceOperation(
  actor: WorkspaceActor,
  request: WorkspaceRequest,
  deps: WorkspaceDependencies,
): Promise<any> {
  if (!(await deps.authorize(actor.organizationId, "integrations.manage")))
    throw new Error("permission_denied");
  if (
    ![
      "callback",
      "status",
      "picker",
      "sheets",
      "preview",
      "import",
      "disconnect",
    ].includes(request.action)
  )
    throw new Error("invalid_action");
  if (request.action === "callback") {
    const state = await verifyGoogleOAuthState({
      secret: deps.stateSecret,
      state: text(request.state, "state", 8192),
    });
    if (
      state.userId !== actor.userId ||
      state.organizationId !== actor.organizationId
    )
      throw new Error("state_identity_mismatch");
    if (
      state.permissions.length !== 1 ||
      state.permissions[0] !== "google.drive.selected"
    )
      throw new Error("state_scope_mismatch");
    const code = text(request.code, "code", 4096);
    if (!(await deps.claimState(state, await sha256Base64Url(state.nonce))))
      throw new Error("state_replayed");
    const token = await googleJson(
      deps,
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",
        body: new URLSearchParams({
          code,
          client_id: deps.clientId,
          client_secret: deps.clientSecret,
          redirect_uri: deps.redirectUri,
          grant_type: "authorization_code",
        }),
      },
    );
    if (
      typeof token.scope !== "string" ||
      token.scope.split(" ").filter(Boolean).length !== 1 ||
      token.scope !== FILE_SCOPE ||
      token.token_type?.toLowerCase() !== "bearer" ||
      !Number.isFinite(token.expires_in) ||
      token.expires_in <= 0
    )
      throw new Error("google_scope_mismatch");
    const credential: ProviderCredentialPayload = {
      accessToken: text(token.access_token, "access_token", 16384),
      refreshToken:
        typeof token.refresh_token === "string"
          ? token.refresh_token
          : undefined,
      scopes: [FILE_SCOPE],
      expiresAt: Date.now() + token.expires_in * 1000,
    };
    const sealed = await sealCredential({
      organizationId: actor.organizationId,
      provider: "google",
      key: deps.credentialKey,
      credential,
    });
    await deps.saveCredential(actor, sealed, credential);
    return { connected: true };
  }
  if (request.action === "disconnect") {
    await deps.disconnect(actor);
    return { connected: false };
  }
  const credential = await deps.loadCredential(actor);
  if (request.action === "status") return { connected: !!credential };
  if (!credential || !credential.scopes?.includes(FILE_SCOPE))
    throw new Error("google_not_connected");
  if (!credential.expiresAt || credential.expiresAt <= Date.now() + 30000)
    throw new Error("google_reauthorization_required");
  if (request.action === "picker") {
    if (!deps.pickerApiKey || !deps.pickerAppId)
      throw new Error("google_picker_not_configured");
    // Picker requires a browser access token. It is returned only to the authorized
    // same-origin request, kept in memory by the caller and never persisted there.
    return {
      accessToken: credential.accessToken,
      apiKey: deps.pickerApiKey,
      appId: deps.pickerAppId,
    };
  }
  const fileId = text(request.fileId, "file_id");
  if (!/^[A-Za-z0-9_-]+$/.test(fileId)) throw new Error("invalid_file_id");
  const headers = { Authorization: `Bearer ${credential.accessToken}` };
  const root = `https://sheets.googleapis.com/v4/spreadsheets/${fileId}`;
  if (request.action === "sheets") {
    const result = await googleJson(
      deps,
      `${root}?fields=sheets.properties(sheetId,title)`,
      { headers },
    );
    if (!Array.isArray(result.sheets))
      throw new Error("google_invalid_response");
    return {
      sheets: result.sheets
        .map((sheet: any) => ({
          id: sheet.properties?.sheetId,
          title: sheet.properties?.title,
        }))
        .filter(
          (sheet: any) =>
            Number.isInteger(sheet.id) && typeof sheet.title === "string",
        ),
    };
  }
  if (!(await deps.authorize(actor.organizationId, "accounting.write")))
    throw new Error("permission_denied");
  const sheetTitle = text(request.sheetTitle, "sheet_title", 100);
  const range = encodeURIComponent(
    `'${sheetTitle.replace(/'/g, "''")}'!A1:Z10002`,
  );
  const result = await googleJson(
    deps,
    `${root}/values/${range}?valueRenderOption=FORMATTED_VALUE&majorDimension=ROWS`,
    { headers },
  );
  if (!Array.isArray(result.values)) throw new Error("google_invalid_response");
  const preview = previewGoogleSheetTransactions(result.values);
  const fingerprint = await sha256Base64Url(
    JSON.stringify({
      fileId,
      sheetTitle,
      rows: preview.rows,
      issues: preview.issues,
    }),
  );
  if (request.action === "preview") return { ...preview, fingerprint };
  if (preview.issues.length || !preview.rows.length)
    throw new Error("preview_has_issues");
  if (request.fingerprint !== fingerprint) throw new Error("preview_changed");
  const debitAccountId = text(request.debitAccountId, "debit_account");
  const creditAccountId = text(request.creditAccountId, "credit_account");
  if (debitAccountId === creditAccountId)
    throw new Error("distinct_accounts_required");
  // SQL rechecks user permission and active connection, locks against concurrent
  // disconnect/import and commits both journal drafts and audit atomically.
  return deps.commitDrafts({
    actor,
    fileId,
    sheetTitle,
    rows: preview.rows,
    debitAccountId,
    creditAccountId,
  });
}
