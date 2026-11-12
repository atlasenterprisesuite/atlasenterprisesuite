// @vitest-environment node
import { describe, it, expect } from "vitest";
import * as workspace from "../../supabase/functions/_shared/google-workspace-service";
import { signGoogleOAuthState } from "../../supabase/functions/_shared/google-oauth";
const secret = "test-google-state-secret-longer-than-32-bytes";
const scope = "https://www.googleapis.com/auth/drive.file";
const matrix = [
  ["reference", "date", "description", "amount", "currency"],
  ["R1", "2026-11-11", "Sale", "12.34", "USD"],
];
function fixture() {
  let claims = 0,
    saved = 0,
    commits = 0,
    calls = 0;
  let allowed = true,
    connected = true;
  const deps: any = {
    stateSecret: secret,
    clientId: "client",
    clientSecret: "secret",
    redirectUri: "https://atlas.example/connect/google",
    credentialKey: new Uint8Array(32).fill(7),
    pickerApiKey: "public-restricted",
    pickerAppId: "123",
    authorize: async () => allowed,
    claimState: async () => ++claims === 1,
    saveCredential: async () => {
      saved++;
    },
    loadCredential: async () =>
      connected
        ? {
            accessToken: "token",
            scopes: [scope],
            expiresAt: Date.now() + 3600000,
          }
        : null,
    disconnect: async () => {
      connected = false;
    },
    commitDrafts: async () => {
      commits++;
      return { imported: 1, duplicates: 0 };
    },
    fetchImpl: async (url: string) => {
      calls++;
      if (url.includes("oauth2.googleapis.com"))
        return Response.json({
          access_token: "token",
          refresh_token: "refresh",
          token_type: "Bearer",
          scope,
          expires_in: 3600,
        });
      if (url.includes("/values/")) return Response.json({ values: matrix });
      return Response.json({
        sheets: [{ properties: { sheetId: 0, title: "Ledger" } }],
      });
    },
  };
  return {
    deps,
    counts: () => ({ claims, saved, commits, calls }),
    deny: () => {
      allowed = false;
    },
  };
}
const actor = { userId: "user-1", organizationId: "org-1" };
describe("Google Workspace service", () => {
  it("exposes the governed workspace operation", () => {
    expect(workspace.runGoogleWorkspaceOperation).toBeTypeOf("function");
  });
  it("denies every operation before storage or provider access if organization permission is missing", async () => {
    const f = fixture();
    f.deny();
    await expect(
      workspace.runGoogleWorkspaceOperation(
        actor,
        { action: "preview", fileId: "file1", sheetTitle: "Ledger" },
        f.deps,
      ),
    ).rejects.toThrow("permission_denied");
    expect(f.counts()).toEqual({ claims: 0, saved: 0, commits: 0, calls: 0 });
  });
  it("binds OAuth callback to the current user and atomically rejects replay before token exchange", async () => {
    const f = fixture();
    const state = await signGoogleOAuthState({
      secret,
      payload: {
        version: 1,
        userId: actor.userId,
        organizationId: actor.organizationId,
        permissions: ["google.drive.selected"],
        nonce: "nonce",
        expiresAt: Date.now() + 60000,
      },
    });
    await expect(
      workspace.runGoogleWorkspaceOperation(
        { ...actor, userId: "other" },
        { action: "callback", state, code: "code" },
        f.deps,
      ),
    ).rejects.toThrow("state_identity_mismatch");
    await workspace.runGoogleWorkspaceOperation(
      actor,
      { action: "callback", state, code: "code" },
      f.deps,
    );
    await expect(
      workspace.runGoogleWorkspaceOperation(
        actor,
        { action: "callback", state, code: "code" },
        f.deps,
      ),
    ).rejects.toThrow("state_replayed");
    expect(f.counts()).toMatchObject({ saved: 1, calls: 1 });
  });
  it("rereads Google and rejects changed previews before importing", async () => {
    const f = fixture();
    const request = {
      action: "preview",
      fileId: "file1",
      sheetTitle: "Ledger",
    };
    const preview: any = await workspace.runGoogleWorkspaceOperation(
      actor,
      request,
      f.deps,
    );
    expect(preview.rows[0].amountMinor).toBe(1234);
    await expect(
      workspace.runGoogleWorkspaceOperation(
        actor,
        {
          ...request,
          action: "import",
          fingerprint: "stale",
          debitAccountId: "debit",
          creditAccountId: "credit",
        },
        f.deps,
      ),
    ).rejects.toThrow("preview_changed");
    expect(f.counts().commits).toBe(0);
    const imported = await workspace.runGoogleWorkspaceOperation(
      actor,
      {
        ...request,
        action: "import",
        fingerprint: preview.fingerprint,
        debitAccountId: "debit",
        creditAccountId: "credit",
      },
      f.deps,
    );
    expect(imported).toEqual({ imported: 1, duplicates: 0 });
  });
  it("fails closed on revoked connections and on provider failures without exposing responses", async () => {
    const f = fixture();
    await workspace.runGoogleWorkspaceOperation(
      actor,
      { action: "disconnect" },
      f.deps,
    );
    await expect(
      workspace.runGoogleWorkspaceOperation(
        actor,
        { action: "sheets", fileId: "file1" },
        f.deps,
      ),
    ).rejects.toThrow("google_not_connected");
    const g = fixture();
    g.deps.fetchImpl = async () =>
      new Response("provider-secret", { status: 429 });
    await expect(
      workspace.runGoogleWorkspaceOperation(
        actor,
        { action: "preview", fileId: "file1", sheetTitle: "Ledger" },
        g.deps,
      ),
    ).rejects.toThrow("google_rate_limited");
  });
});
