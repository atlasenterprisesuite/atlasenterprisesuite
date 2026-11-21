import { authorizedAtlasFetch } from "./atlasSession";
export type WorkspaceAccount = {
  id: string;
  account_number: string;
  name: string;
};
export async function workspaceRequest(
  action: string,
  payload: Record<string, unknown>,
  organizationId: string,
): Promise<any> {
  const response = await authorizedAtlasFetch(
    "/functions/v1/atlas-google-workspace",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, action, organizationId }),
    },
  );
  const body = await response.json();
  if (!response.ok)
    throw new Error(
      typeof body.error === "string" ? body.error : "workspace_request_failed",
    );
  return body;
}
export async function startGoogleWorkspace(
  organizationId: string,
): Promise<void> {
  const response = await authorizedAtlasFetch(
    "/functions/v1/atlas-google-connect",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizationId,
        permissions: ["google.drive.selected"],
      }),
    },
  );
  const result = await response.json();
  if (!response.ok) throw new Error("google_workspace_not_configured");
  const url = new URL(result.authorizationUrl);
  if (
    url.origin !== "https://accounts.google.com" ||
    url.pathname !== "/o/oauth2/v2/auth"
  )
    throw new Error("invalid_authorization_url");
  window.location.assign(url.href);
}
export async function loadWorkspaceAccounts(
  org: string,
): Promise<WorkspaceAccount[]> {
  const response = await authorizedAtlasFetch(
    `/rest/v1/chart_of_accounts?org_id=eq.${encodeURIComponent(org)}&select=id,account_number,name&order=account_number&limit=1000`,
  );
  if (!response.ok) throw new Error("accounting_accounts_unavailable");
  const rows = await response.json();
  if (!Array.isArray(rows)) throw new Error("accounting_accounts_unavailable");
  return rows;
}
let pickerLoader: Promise<void> | undefined;
function loadPicker(): Promise<void> {
  if (pickerLoader) return pickerLoader;
  pickerLoader = new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      pickerLoader = undefined;
      reject(new Error("google_picker_timeout"));
    }, 15000);
    const ready = () => {
      const gapi = (window as any).gapi;
      gapi.load("picker", {
        callback: () => {
          clearTimeout(timer);
          resolve();
        },
        onerror: () => {
          clearTimeout(timer);
          pickerLoader = undefined;
          reject(new Error("google_picker_unavailable"));
        },
      });
    };
    if ((window as any).gapi) {
      ready();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.onload = ready;
    script.onerror = () => {
      clearTimeout(timer);
      pickerLoader = undefined;
      script.remove();
      reject(new Error("google_picker_unavailable"));
    };
    document.head.append(script);
  });
  return pickerLoader;
}
export async function chooseGoogleSheet(config: {
  accessToken: string;
  apiKey: string;
  appId: string;
}): Promise<{ id: string; name: string } | null> {
  await loadPicker();
  return new Promise((resolve, reject) => {
    const p = (window as any).google.picker;
    const view = new p.DocsView(p.ViewId.SPREADSHEETS).setMimeTypes(
      "application/vnd.google-apps.spreadsheet",
    );
    const picker = new p.PickerBuilder()
      .addView(view)
      .setOAuthToken(config.accessToken)
      .setDeveloperKey(config.apiKey)
      .setAppId(config.appId)
      .setOrigin(window.location.origin)
      .setCallback((data: any) => {
        if (data.action === p.Action.CANCEL) {
          picker.dispose();
          resolve(null);
        }
        if (data.action === p.Action.PICKED) {
          const doc = data.docs?.[0];
          picker.dispose();
          if (typeof doc?.id !== "string")
            reject(new Error("google_picker_invalid_selection"));
          else resolve({ id: doc.id, name: doc.name || "Spreadsheet" });
        }
        if (data.action === "error") {
          picker.dispose();
          reject(new Error("google_picker_unavailable"));
        }
      })
      .build();
    picker.setVisible(true);
  });
}
