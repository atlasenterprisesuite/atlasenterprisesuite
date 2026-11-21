import { runGoogleWorkspaceOperation } from "../_shared/google-workspace-service.ts";
import {
  openCredential,
  sealCredential,
} from "../_shared/integration-credential-vault.ts";
import type { ProviderCredentialPayload } from "../_shared/integration-credential-vault.ts";

const allowed = new Set(
  (
    Deno.env.get("ATLAS_ALLOWED_ORIGINS") ||
    "https://www.atlasenterprisesuite.com,https://atlasenterprisesuite.com"
  )
    .split(",")
    .map((v) => v.trim()),
);
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    Vary: "Origin",
  };
  if (origin && !allowed.has(origin))
    return new Response("{}", { status: 403, headers });
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  headers["Access-Control-Allow-Headers"] =
    "authorization,apikey,content-type,x-client-info";
  headers["Access-Control-Allow-Methods"] = "POST,OPTIONS";
  const reply = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers });
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return reply(405, { error: "method_not_allowed" });
  const bearer = req.headers.get("Authorization") || "";
  if (!bearer.startsWith("Bearer "))
    return reply(401, { error: "authentication_required" });
  const root = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const credentialKey = Deno.env.get("ATLAS_INTEGRATION_CREDENTIAL_KEY") || "";
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID") || "";
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";
  const redirectUri = Deno.env.get("GOOGLE_REDIRECT_URI") || "";
  const stateSecret = Deno.env.get("GOOGLE_OAUTH_STATE_SECRET") || "";
  if (
    !root ||
    !serviceKey ||
    !anonKey ||
    !credentialKey ||
    !clientId ||
    !clientSecret ||
    !redirectUri ||
    stateSecret.length < 32
  )
    return reply(503, { error: "google_workspace_not_configured" });
  // Separate user-authorized RPCs from server-only credential/state storage.
  const call = async (
    path: string,
    init: RequestInit = {},
    admin = false,
  ): Promise<any> => {
    const response = await fetch(`${root}${path}`, {
      ...init,
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: admin ? `Bearer ${serviceKey}` : bearer,
        apikey: admin ? serviceKey : anonKey,
        "Content-Type": "application/json",
        Prefer: "return=representation",
        ...init.headers,
      },
    });
    if (!response.ok) throw new Error("workspace_storage_failed");
    const body = await response.text();
    return body ? JSON.parse(body) : null;
  };
  try {
    let user;
    try {
      user = await call("/auth/v1/user");
    } catch {
      return reply(401, { error: "invalid_session" });
    }
    if (!user?.id) return reply(401, { error: "invalid_session" });
    const raw = await req.text();
    if (raw.length > 20000) return reply(413, { error: "request_too_large" });
    const body = JSON.parse(raw);
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        body.organizationId,
      )
    )
      return reply(400, { error: "invalid_organization" });
    const actor = { userId: user.id, organizationId: body.organizationId };
    const connectionQuery = `org_id=eq.${actor.organizationId}&provider=eq.google&connection_name=eq.${encodeURIComponent("workspace-sheets:" + actor.userId)}`;
    const authorize = async (org: string, permission: string) =>
      (await call("/rest/v1/rpc/has_identity_permission", {
        method: "POST",
        body: JSON.stringify({ o: org, p: permission }),
      })) === true;
    const result = await runGoogleWorkspaceOperation(actor, body, {
      stateSecret,
      clientId,
      clientSecret,
      redirectUri,
      credentialKey,
      pickerApiKey: Deno.env.get("GOOGLE_PICKER_API_KEY") || "",
      pickerAppId: Deno.env.get("GOOGLE_PICKER_APP_ID") || "",
      authorize,
      claimState: async (state, hash) => {
        const rows = await call(
          `/rest/v1/atlas_oauth_states?provider=eq.google&org_id=eq.${actor.organizationId}&user_id=eq.${actor.userId}&nonce_hash=eq.${encodeURIComponent(hash)}&consumed_at=is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}&requested_permissions=eq.${encodeURIComponent("{google.drive.selected}")}`,
          {
            method: "PATCH",
            body: JSON.stringify({ consumed_at: new Date().toISOString() }),
          },
          true,
        );
        return rows?.length === 1;
      },
      saveCredential: async (_, sealed, credential) => {
        const row = {
          org_id: actor.organizationId,
          provider: "google",
          ciphertext: sealed.ciphertext,
          iv: sealed.iv,
          algorithm: sealed.algorithm,
          key_version: sealed.keyVersion,
          expires_at: new Date(credential.expiresAt!).toISOString(),
        };
        const inserted = await call(
          "/rest/v1/atlas_integration_credentials",
          { method: "POST", body: JSON.stringify(row) },
          true,
        );
        const id = inserted?.[0]?.id;
        if (!id) throw new Error("workspace_storage_failed");
        try {
          const previous = await call(
            `/rest/v1/atlas_integration_connections?${connectionQuery}&select=credential_ref`,
            {},
            true,
          );
          await call(
            "/rest/v1/atlas_integration_connections?on_conflict=org_id,provider,connection_name",
            {
              method: "POST",
              headers: {
                Prefer: "resolution=merge-duplicates,return=representation",
              },
              body: JSON.stringify({
                org_id: actor.organizationId,
                provider: "google",
                connection_name: "workspace-sheets:" + actor.userId,
                auth_kind: "oauth2",
                endpoint_origin: "https://sheets.googleapis.com",
                authorized: true,
                provider_verified: true,
                state: "connected",
                credential_ref: id,
                granted_scopes: credential.scopes,
                created_by: actor.userId,
                updated_by: actor.userId,
                connected_by: actor.userId,
                connected_at: new Date().toISOString(),
                revoked_at: null,
              }),
            },
            true,
          );
          if (previous?.[0]?.credential_ref)
            await call(
              `/rest/v1/atlas_integration_credentials?id=eq.${previous[0].credential_ref}&org_id=eq.${actor.organizationId}`,
              { method: "DELETE" },
              true,
            );
        } catch {
          // New encrypted row is unusable without registry linkage; fail closed.
          throw new Error("workspace_storage_failed");
        }
      },
      loadCredential: async () => {
        const connections = await call(
          `/rest/v1/atlas_integration_connections?${connectionQuery}&authorized=eq.true&provider_verified=eq.true&state=eq.connected&select=credential_ref`,
          {},
          true,
        );
        const id = connections?.[0]?.credential_ref;
        if (!id) return null;
        const rows = await call(
          `/rest/v1/atlas_integration_credentials?id=eq.${id}&org_id=eq.${actor.organizationId}&provider=eq.google`,
          {},
          true,
        );
        const row = rows?.[0];
        if (!row) return null;
        let credential = await openCredential({
          organizationId: actor.organizationId,
          provider: "google",
          key: credentialKey,
          sealed: {
            ciphertext: row.ciphertext,
            iv: row.iv,
            algorithm: row.algorithm,
            keyVersion: row.key_version,
          },
        });
        if (
          credential.expiresAt &&
          credential.expiresAt < Date.now() + 30000 &&
          credential.refreshToken
        ) {
          const response = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            redirect: "error",
            signal: AbortSignal.timeout(15000),
            body: new URLSearchParams({
              grant_type: "refresh_token",
              refresh_token: credential.refreshToken,
              client_id: clientId,
              client_secret: clientSecret,
            }),
          });
          if (!response.ok) throw new Error("google_reauthorization_required");
          const token = await response.json();
          if (
            typeof token.access_token !== "string" ||
            !Number.isFinite(token.expires_in) ||
            token.expires_in <= 0 ||
            token.token_type?.toLowerCase() !== "bearer" ||
            (token.scope &&
              token.scope !== "https://www.googleapis.com/auth/drive.file")
          )
            throw new Error("google_reauthorization_required");
          credential = {
            ...credential,
            accessToken: token.access_token,
            expiresAt: Date.now() + token.expires_in * 1000,
          } as ProviderCredentialPayload;
          const sealed = await sealCredential({
            organizationId: actor.organizationId,
            provider: "google",
            key: credentialKey,
            credential,
          });
          const updated = await call(
            `/rest/v1/atlas_integration_credentials?id=eq.${id}&org_id=eq.${actor.organizationId}&ciphertext=eq.${encodeURIComponent(row.ciphertext)}`,
            {
              method: "PATCH",
              body: JSON.stringify({
                ciphertext: sealed.ciphertext,
                iv: sealed.iv,
                expires_at: new Date(credential.expiresAt!).toISOString(),
              }),
            },
            true,
          );
          if (updated?.length !== 1) throw new Error("google_retry_required");
          const active = await call(
            `/rest/v1/atlas_integration_connections?${connectionQuery}&authorized=eq.true&state=eq.connected&select=id`,
            {},
            true,
          );
          if (!active?.length) throw new Error("google_not_connected");
        }
        return credential;
      },
      disconnect: async () => {
        const rows = await call(
          `/rest/v1/atlas_integration_connections?${connectionQuery}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              authorized: false,
              provider_verified: false,
              state: "revoked",
              revoked_at: new Date().toISOString(),
              updated_by: actor.userId,
            }),
          },
          true,
        );
        for (const row of rows || [])
          if (row.credential_ref)
            await call(
              `/rest/v1/atlas_integration_credentials?id=eq.${row.credential_ref}&org_id=eq.${actor.organizationId}`,
              { method: "DELETE" },
              true,
            );
      },
      commitDrafts: async (input) =>
        call(
          "/rest/v1/rpc/import_google_sheet_drafts",
          {
            method: "POST",
            body: JSON.stringify({
              p_actor: actor.userId,
              p_org: actor.organizationId,
              p_file: input.fileId,
              p_sheet: input.sheetTitle,
              p_debit: input.debitAccountId,
              p_credit: input.creditAccountId,
              p_rows: input.rows,
            }),
          },
          true,
        ),
    });
    return reply(200, result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const safe = new Set([
      "permission_denied",
      "state_identity_mismatch",
      "state_replayed",
      "state_scope_mismatch",
      "google_scope_mismatch",
      "google_not_connected",
      "google_reauthorization_required",
      "google_retry_required",
      "google_picker_not_configured",
      "google_rate_limited",
      "google_request_failed",
      "google_unavailable",
      "google_response_too_large",
      "google_invalid_response",
      "preview_changed",
      "preview_has_issues",
      "distinct_accounts_required",
      "workspace_storage_failed",
    ]);
    return reply(
      message === "permission_denied"
        ? 403
        : message === "google_rate_limited"
          ? 429
          : 400,
      { error: safe.has(message) ? message : "workspace_request_failed" },
    );
  }
});
