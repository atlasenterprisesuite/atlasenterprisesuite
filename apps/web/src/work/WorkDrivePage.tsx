import { useEffect, useRef, useState } from 'react';
import {
  deleteDriveFile,
  downloadDriveFile,
  listDriveFiles,
  uploadDriveFile,
  type AtlasDriveFile
} from './workOsAppsApi';
import { WorkSubnav } from './WorkSubnav';

function sizeLabel(bytes: number) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function WorkDrivePage() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<AtlasDriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function refresh() {
    setError('');
    try { setFiles(await listDriveFiles()); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'drive_unavailable'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void refresh(); }, []);

  async function upload(file: File) {
    setBusy('upload');
    setError('');
    setMessage('');
    try {
      await uploadDriveFile(file);
      setMessage('File stored in the private organization Drive with SHA-256 provenance.');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'drive_upload_failed');
    } finally {
      setBusy('');
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function download(file: AtlasDriveFile) {
    setBusy(file.id);
    setError('');
    try {
      const blob = await downloadDriveFile(file);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = file.file_name;
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'drive_download_failed');
    } finally {
      setBusy('');
    }
  }

  async function remove(file: AtlasDriveFile) {
    setBusy(file.id);
    setError('');
    setMessage('');
    try {
      await deleteDriveFile(file);
      setMessage('File removed from Drive and its metadata index.');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'drive_delete_failed');
    } finally {
      setBusy('');
    }
  }

  return (
    <section className="work-page page-stack">
      <WorkSubnav />
      <header className="page-header">
        <p className="eyebrow">ATLAS Work · Drive</p>
        <h1>ATLAS Drive</h1>
        <p>Private organization files with tenant-scoped Storage policies, metadata provenance and audit evidence. Drive does not claim external cloud-provider synchronization unless a connection is separately verified.</p>
        <div className="atlas-action-row">
          <label className="execution-action">
            {busy === 'upload' ? 'Uploading…' : 'Upload file'}
            <input ref={inputRef} type="file" hidden disabled={busy === 'upload'} onChange={event => {
              const file = event.currentTarget.files?.[0];
              if (file) void upload(file);
            }} />
          </label>
          <button className="module-experience-action secondary" type="button" onClick={() => void refresh()} disabled={loading}>Refresh</button>
        </div>
      </header>

      <div className="notice">Maximum file size: 25 MB. Files are stored in the private <code>atlas-drive</code> bucket; browser access is still authorization-checked on every request.</div>
      {error ? <div className="notice strong" role="alert">{error}</div> : null}
      {message ? <div className="notice" role="status">{message}</div> : null}
      {loading ? <div className="notice" role="status">Loading Drive metadata…</div> : null}

      <div className="module-experience-grid">
        {files.map(file => (
          <article className="module-experience-card is-active" key={file.id}>
            <span className="module-experience-card-label">{file.mime_type}</span>
            <strong>{file.file_name}</strong>
            <p>{sizeLabel(file.size_bytes)} · {new Date(file.created_at).toLocaleString()}</p>
            <small className="module-experience-card-status">SHA-256 {file.sha256 ? file.sha256.slice(0, 16) + '…' : 'not recorded'}</small>
            <div className="atlas-action-row">
              <button type="button" disabled={busy === file.id} onClick={() => void download(file)}>Download</button>
              <button type="button" disabled={busy === file.id} onClick={() => void remove(file)}>Delete</button>
            </div>
          </article>
        ))}
      </div>
      {!loading && !files.length ? <div className="notice">No files are stored in ATLAS Drive for the active organization.</div> : null}
    </section>
  );
}
