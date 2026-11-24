import { useState } from 'react';
import { importAtlasMemoryDrafts, type AtlasMemoryImportDraft } from './memoryApi';

type ReviewRow = {
  draft: AtlasMemoryImportDraft;
  selected: boolean;
  text: string;
  modules: string;
};
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const SOURCE_HASH = /^[0-9a-f]{64}$/;

function parsePrivateBatch(value: unknown): ReviewRow[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid batch file');
  const batch = value as Record<string, unknown>;
  if (batch.approve !== false || !Array.isArray(batch.records) ||
      batch.records.length < 1 || batch.records.length > 50) {
    throw new Error('Expected a draft-only ATLAS batch with 1–50 records');
  }
  return batch.records.map((unknownRow, index) => {
    if (!unknownRow || typeof unknownRow !== 'object' || Array.isArray(unknownRow)) {
      throw new Error(`Invalid record at position ${index + 1}`);
    }
    const record = unknownRow as Record<string, unknown>;
    const json = record.content_json;
    if (!json || typeof json !== 'object' || Array.isArray(json)) {
      throw new Error(`Invalid content at position ${index + 1}`);
    }
    const contents = json as Record<string, unknown>;
    if (record.kind !== 'note' || record.source_type !== 'chat_import' ||
        record.sensitivity !== 'restricted' ||
        typeof record.source_ref !== 'string' || !record.source_ref ||
        typeof record.source_hash !== 'string' || !SOURCE_HASH.test(record.source_hash) ||
        typeof record.title !== 'string' || !record.title.trim() ||
        typeof record.summary !== 'string' ||
        typeof contents.text !== 'string' || !contents.text.trim() ||
        !Array.isArray(record.module_ids) || !record.module_ids.length ||
        !record.module_ids.every(value => typeof value === 'string') ||
        !Array.isArray(record.tags) || !record.tags.every(value => typeof value === 'string')) {
      throw new Error(`Unverified or non-restricted chat draft at position ${index + 1}`);
    }
    const draft = record as unknown as AtlasMemoryImportDraft;
    return {
      draft,
      selected: false,
      text: contents.text as string,
      modules: draft.module_ids.join(', ')
    };
  });
}

function normalizeModules(text: string) {
  return [...new Set(text.split(',').map(value => value.trim()).filter(Boolean))].slice(0, 40);
}

async function sourceHash(sourceRef: string, text: string) {
  if (!globalThis.crypto?.subtle) throw new Error('SHA-256 is not available in this secure browser session');
  const bytes = new TextEncoder().encode(sourceRef + '\n' + text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Consent-first local batch intake. Files are parsed in browser memory only.
 * Only explicitly selected, reviewed drafts are sent to the authenticated API.
 */
export function ChatImportReviewPanel({ canImport, onImported }: {
  canImport: boolean;
  onImported: () => void;
}) {
  const [rows, setRows] = useState<ReviewRow[] | null>(null);
  const [fileName, setFileName] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const selected = rows?.filter(row => row.selected).length ?? 0;

  async function loadFile(file: File | null) {
    setRows(null);
    setFileName('');
    setConsent(false);
    setError(null);
    setSuccess(null);
    if (!file) return;
    if (file.size < 1 || file.size > MAX_FILE_BYTES || !file.name.toLowerCase().endsWith('.json')) {
      setError('Choose a local ATLAS draft JSON batch no larger than 5 MB.');
      return;
    }
    try {
      const parsed = parsePrivateBatch(JSON.parse(await file.text()) as unknown);
      setRows(parsed);
      setFileName(file.name);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Invalid local batch');
    }
  }

  function editRow(index: number, changes: Partial<ReviewRow>) {
    setConsent(false);
    setRows(current => current?.map((row, i) => i === index ? { ...row, ...changes } : row) ?? null);
  }

  async function importSelected() {
    if (!canImport || busy || !rows || !selected || !consent) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const items: AtlasMemoryImportDraft[] = [];
      for (const row of rows) {
        if (!row.selected) continue;
        const text = row.text.trim();
        const modules = normalizeModules(row.modules);
        if (!text || !modules.length || text.length > 12000) {
          throw new Error('Every selected draft needs text (up to 12,000 characters) and at least one module.');
        }
        const changed = text !== row.draft.content_json.text;
        items.push({
          ...row.draft,
          content_json: changed
            ? { ...row.draft.content_json, text, original_source_hash: row.draft.source_hash, manually_redacted: true }
            : row.draft.content_json,
          source_hash: changed ? await sourceHash(row.draft.source_ref, text) : row.draft.source_hash,
          module_ids: modules,
          tags: changed ? [...new Set([...row.draft.tags, 'manually-redacted'])] : row.draft.tags,
          sensitivity: 'restricted'
        });
      }
      const result = await importAtlasMemoryDrafts(items);
      if (result.records.length !== items.length) throw new Error('The server did not confirm the complete batch.');
      setRows(null);
      setFileName('');
      setConsent(false);
      setSuccess(`${items.length} restricted draft(s) imported. None were approved automatically.`);
      onImported();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The draft batch was not confirmed.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="workspace-card page-stack" aria-labelledby="atlas-chat-intake-heading">
    <div>
      <p className="eyebrow">ATLAS 777 REVIEW · Authorized source</p>
      <h2 id="atlas-chat-intake-heading">Local chat import review</h2>
      <p className="muted">Select records to import from a privately prepared ATLAS draft JSON batch. The original ChatGPT export stays on your device. Nothing is uploaded until you explicitly authorize selected records.</p>
    </div>
    {!canImport ? <p className="notice">Only an authorized organization owner or administrator may import restricted drafts.</p> : <>
      <label className="field"><span>Choose an ATLAS draft batch JSON file</span>
        <input type="file" accept=".json,application/json" disabled={busy} onChange={event => { void loadFile(event.currentTarget.files?.[0] ?? null); event.currentTarget.value = ''; }} />
      </label>
      {rows ? <>
        <p role="status" aria-live="polite">Local preview: {fileName} · {rows.length} draft(s) · {selected} selected. Every record starts unselected.</p>
        <div className="page-stack" aria-label="Select records to import">
          {rows.map((row, index) => <details key={row.draft.source_ref} className="workspace-card">
            <summary>{index + 1}. {row.draft.title} · {row.draft.module_ids.join(', ')}</summary>
            <p className="muted">Source: {row.draft.source_ref} · Original SHA-256: {row.draft.source_hash}</p>
            <label className="field"><span>Review and redact content before importing</span>
              <textarea rows={7} maxLength={12000} value={row.text} onChange={event => editRow(index, { text: event.target.value })} />
            </label>
            <label className="field"><span>Proposed module IDs (comma-separated)</span>
              <input value={row.modules} onChange={event => editRow(index, { modules: event.target.value })} />
            </label>
            <label className="field"><input type="checkbox" checked={row.selected} onChange={event => editRow(index, { selected: event.target.checked })} />
              <span>Include this reviewed, sanitized record as a restricted draft</span>
            </label>
          </details>)}
        </div>
        <label className="field">
          <input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} />
          <span>I confirm that I am authorized to store these selected records in this organization, have removed secrets and unrelated personal data, and understand they remain unapproved drafts.</span>
        </label>
        <div className="work-actions">
          <button type="button" className="execution-action" disabled={busy || !selected || !consent} onClick={() => void importSelected()}>
            {busy ? 'Importing…' : 'Import selected drafts'}
          </button>
          <button type="button" disabled={busy} onClick={() => { setRows(null); setConsent(false); setFileName(''); }}>Clear local preview</button>
        </div>
      </> : null}
    </>}
    {error ? <div className="work-error" role="alert">{error}</div> : null}
    {success ? <p className="notice strong" role="status">{success}</p> : null}
  </section>;
}
