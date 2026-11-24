import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ATLAS_SESSION_EVENT,
  getActiveAtlasOrganization,
} from "../../lib/atlasSession";
import {
  chooseGoogleSheet,
  loadWorkspaceAccounts,
  startGoogleWorkspace,
  workspaceRequest,
  type WorkspaceAccount,
} from "../../lib/googleWorkspaceApi";
import type {
  SheetTransaction,
  SheetPreviewIssue,
} from "../../../../../packages/core/src/google-sheets-preview";
import "./google-workspace.css";
type Preview = {
  rows: SheetTransaction[];
  issues: SheetPreviewIssue[];
  fingerprint: string;
};
export function GoogleWorkspacePage() {
  const [org, setOrg] = useState(""),
    [connected, setConnected] = useState(false),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [file, setFile] = useState<{ id: string; name: string } | null>(null),
    [sheets, setSheets] = useState<{ id: number; title: string }[]>([]),
    [sheet, setSheet] = useState(""),
    [preview, setPreview] = useState<Preview | null>(null);
  const [accounts, setAccounts] = useState<WorkspaceAccount[]>([]),
    [debit, setDebit] = useState(""),
    [credit, setCredit] = useState("");
  const generation = useRef(0),
    callbackHandled = useRef(false);
  useEffect(() => {
    let mounted = true;
    async function load() {
      const version = ++generation.current;
      setBusy(true);
      setError("");
      setConnected(false);
      setFile(null);
      setPreview(null);
      setSheets([]);
      setSheet("");
      setAccounts([]);
      setDebit("");
      setCredit("");
      setNotice("");
      try {
        const active = await getActiveAtlasOrganization();
        if (!mounted || version !== generation.current) return;
        setOrg(active.id);
        const params = new URLSearchParams(window.location.search);
        if (params.has("error")) {
          window.history.replaceState(null, "", window.location.pathname);
          throw new Error("Google authorization was cancelled.");
        }
        if (
          params.has("code") &&
          params.has("state") &&
          !callbackHandled.current
        ) {
          callbackHandled.current = true;
          const code = params.get("code"),
            state = params.get("state");
          // Clear the authorization code and state before any provider request.
          window.history.replaceState(null, "", window.location.pathname);
          await workspaceRequest("callback", { code, state }, active.id);
        }
        const status = await workspaceRequest("status", {}, active.id);
        if (!mounted || version !== generation.current) return;
        setConnected(status.connected === true);
        const list = await loadWorkspaceAccounts(active.id);
        if (mounted && version === generation.current) setAccounts(list);
      } catch (cause) {
        if (mounted && version === generation.current)
          setError(
            cause instanceof Error ? cause.message : "Unable to load workspace",
          );
      } finally {
        if (mounted && version === generation.current) setBusy(false);
      }
    }
    void load();
    const changed = () => void load();
    window.addEventListener(ATLAS_SESSION_EVENT, changed);
    return () => {
      mounted = false;
      generation.current++;
      window.removeEventListener(ATLAS_SESSION_EVENT, changed);
    };
  }, []);
  async function act(task: () => Promise<void>) {
    const version = generation.current;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
    } catch (cause) {
      if (version === generation.current)
        setError(
          cause instanceof Error ? cause.message : "Workspace request failed",
        );
    } finally {
      if (version === generation.current) setBusy(false);
    }
  }
  async function choose() {
    const version = generation.current;
    const config = await workspaceRequest("picker", {}, org);
    const selected = await chooseGoogleSheet(config);
    config.accessToken = "";
    if (!selected || version !== generation.current) return;
    setPreview(null);
    setFile(selected);
    setSheets([]);
    setSheet("");
    const result = await workspaceRequest(
      "sheets",
      { fileId: selected.id },
      org,
    );
    if (version !== generation.current) return;
    setSheets(result.sheets);
    setSheet(result.sheets[0]?.title || "");
  }
  async function review() {
    const version = generation.current;
    setPreview(null);
    const result = await workspaceRequest(
      "preview",
      { fileId: file!.id, sheetTitle: sheet },
      org,
    );
    if (version === generation.current) setPreview(result);
  }
  async function commit() {
    const version = generation.current;
    const result = await workspaceRequest(
      "import",
      {
        fileId: file!.id,
        sheetTitle: sheet,
        fingerprint: preview!.fingerprint,
        debitAccountId: debit,
        creditAccountId: credit,
      },
      org,
    );
    if (version !== generation.current) return;
    setNotice(
      `${result.imported} drafts imported; ${result.duplicates} existing references skipped.`,
    );
    setPreview(null);
  }
  const ready =
    !!preview &&
    preview.rows.length > 0 &&
    preview.issues.length === 0 &&
    !!debit &&
    !!credit &&
    debit !== credit;
  return (
    <section
      className="page-stack google-workspace"
      aria-labelledby="google-workspace-title"
    >
      <header className="page-header">
        <p className="eyebrow">ATLAS Connect · Finance</p>
        <h1 id="google-workspace-title">Google Workspace</h1>
        <p>
          Choose a Google spreadsheet, validate USD transactions and import
          balanced journal drafts.
        </p>
        <Link to="/connect">Back to Connect</Link>
      </header>
      <p role="status" aria-live="polite">
        {busy
          ? "Processing…"
          : connected
            ? "Google connection authorized"
            : "Google connection required"}
      </p>
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      <div className="google-workspace-actions">
        <button
          disabled={busy || !org}
          onClick={() => void act(() => startGoogleWorkspace(org))}
        >
          {connected ? "Reconnect Google" : "Connect Google"}
        </button>
        <button disabled={busy || !connected} onClick={() => void act(choose)}>
          Choose spreadsheet
        </button>
        <button
          disabled={busy || !connected}
          onClick={() =>
            void act(async () => {
              await workspaceRequest("disconnect", {}, org);
              setConnected(false);
              setFile(null);
              setPreview(null);
              setSheets([]);
            })
          }
        >
          Disconnect Google
        </button>
      </div>
      <p>
        Access is limited to files you share with ATLAS. Disconnect removes the
        ATLAS connection; existing journal drafts remain.
      </p>
      <div className="google-workspace-fields">
        <label>
          Debit account for positive amounts
          <select
            value={debit}
            disabled={busy}
            onChange={(e) => setDebit(e.target.value)}
          >
            <option value="">Choose account</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.account_number} · {a.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Credit account for positive amounts
          <select
            value={credit}
            disabled={busy}
            onChange={(e) => setCredit(e.target.value)}
          >
            <option value="">Choose account</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.account_number} · {a.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p>
        Negative amounts reverse these accounts. Imports remain drafts for
        accounting review.
      </p>
      {file && (
        <div>
          <h2>{file.name}</h2>
          <label>
            Worksheet
            <select
              value={sheet}
              disabled={busy}
              onChange={(e) => {
                setSheet(e.target.value);
                setPreview(null);
              }}
            >
              {sheets.map((s) => (
                <option key={s.id} value={s.title}>
                  {s.title}
                </option>
              ))}
            </select>
          </label>
          <button disabled={busy || !sheet} onClick={() => void act(review)}>
            Preview transactions
          </button>
        </div>
      )}
      <details>
        <summary>Required spreadsheet format</summary>
        <p>
          Headers: reference, date, description, amount, currency. Use
          YYYY-MM-DD dates, decimal amounts such as 123.45, and USD. Up to
          10,000 rows and 26 columns. Duplicate references and invalid rows must
          be resolved before importing.
        </p>
      </details>
      {preview && (
        <>
          <h2>Preview · {preview.rows.length} valid rows</h2>
          {preview.issues.length > 0 && (
            <div role="alert">
              <p>
                Resolve {preview.issues.length} issues in Google Sheets, then
                preview again.
              </p>
              <ul>
                {preview.issues.slice(0, 100).map((i, n) => (
                  <li key={n}>
                    Row {i.rowNumber}: {i.code}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="google-workspace-table">
            <table>
              <caption>
                First {Math.min(100, preview.rows.length)} validated
                transactions
              </caption>
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Reference</th>
                  <th>Date</th>
                  <th>Description</th>
                  <th>USD amount</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 100).map((row) => (
                  <tr key={row.rowNumber}>
                    <td>{row.rowNumber}</td>
                    <td>{row.reference}</td>
                    <td>{row.date}</td>
                    <td>{row.description}</td>
                    <td>{(row.amountMinor / 100).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button disabled={busy || !ready} onClick={() => void act(commit)}>
            Import journal drafts
          </button>
        </>
      )}
    </section>
  );
}
