import { useMemo, useState } from 'react';
import { ATLAS_NEWS_WHATSAPP_CHANNEL } from '../../../../../packages/connect/destinations';
import { createDevelopmentPermissionAdapter } from '../../../../../packages/connect/permissions';
import { createPublicationService } from '../../../../../packages/connect/service';
import { BrowserConnectStore } from '../../../../../packages/connect/storage';
import type { PublishAttachment, PublishContentType, PublishDraft } from '../../../../../packages/connect/types';

const destination = ATLAS_NEWS_WHATSAPP_CHANNEL;

function statusLabel(draft: PublishDraft | null): string {
  if (!draft) return 'Unsaved';
  if (draft.status === 'draft') return 'Draft';
  if (draft.status === 'ready') return 'Ready';
  if (draft.status === 'awaiting_manual_publish') return 'Awaiting manual confirmation';
  if (draft.status === 'published') return 'Published';
  if (draft.status === 'publishing') return 'Publishing';
  return 'Failed';
}

export function PublishPage() {
  const service = useMemo(() => createPublicationService({
    store: new BrowserConnectStore(window.localStorage),
    permissions: createDevelopmentPermissionAdapter(),
    actor: 'development-user',
    now: () => new Date().toISOString()
  }), []);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [link, setLink] = useState('');
  const [contentType, setContentType] = useState<PublishContentType>('text');
  const [attachment, setAttachment] = useState<PublishAttachment | null>(null);
  const [providerReference, setProviderReference] = useState('');
  const [current, setCurrent] = useState<PublishDraft | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('Prepare the exact public content, then save it for review.');

  function resetWorkflowForEdit() {
    if (current) {
      setCurrent(null);
      setMessage('Content changed. Save a new draft before continuing.');
    }
    setError('');
  }

  function saveDraft() {
    try {
      const saved = service.saveDraft({
        title,
        body,
        link: link.trim() ? link : null,
        contentType,
        attachment,
        destinationId: destination.id
      });
      setCurrent(saved);
      setError('');
      setMessage('Draft saved');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to save draft.');
    }
  }

  function markReady() {
    if (!current) return;
    try {
      const ready = service.markReady(current.id);
      setCurrent(ready);
      setError('');
      setMessage('Ready');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to validate draft.');
    }
  }

  function startHandoff() {
    if (!current) return;
    try {
      const handoff = service.startManualHandoff(current.id);
      setCurrent(handoff);
      setError('');
      setMessage('Awaiting manual confirmation');
      if (destination.publicUrl) {
        window.open(destination.publicUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to start handoff.');
    }
  }

  function confirmPublished() {
    if (!current) return;
    try {
      const published = service.confirmManualPublication(current.id, providerReference || null);
      setCurrent(published);
      setError('');
      setMessage('Manual confirmation receipt recorded');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to confirm publication.');
    }
  }

  function selectAttachment(file: File | null) {
    resetWorkflowForEdit();
    setAttachment(file ? { name: file.name, mimeType: file.type, sizeBytes: file.size } : null);
  }

  return (
    <section className="page-stack">
      <header className="page-header">
        <p className="eyebrow">ATLAS Creator Studio</p>
        <h1>Publish</h1>
        <p>Prepare one reviewed update for ATLAS Connect. WhatsApp Channels is currently a manual handoff destination.</p>
      </header>

      <div className="notice strong">Development local persistence — not tenant-safe production storage</div>
      <div className="capability-banner warning">
        <strong>Public content</strong>
        <span>This update may become publicly visible. Opening WhatsApp does not mean it was published.</span>
      </div>

      <div className="publish-layout">
        <form className="publish-form" onSubmit={(event) => event.preventDefault()}>
          <label className="field">
            <span>Destination</span>
            <select value={destination.id} disabled aria-label="Destination">
              <option value={destination.id}>{destination.name}</option>
            </select>
          </label>

          <label className="field">
            <span>Internal title</span>
            <input value={title} onChange={(event) => { resetWorkflowForEdit(); setTitle(event.target.value); }} />
          </label>

          <label className="field">
            <span>Content type</span>
            <select
              value={contentType}
              onChange={(event) => {
                resetWorkflowForEdit();
                setContentType(event.target.value as PublishContentType);
                setAttachment(null);
              }}
            >
              <option value="text">Text</option>
              <option value="link">Link</option>
              <option value="image">Image</option>
              <option value="video">Video</option>
            </select>
          </label>

          <label className="field">
            <span>Post text</span>
            <textarea value={body} rows={7} onChange={(event) => { resetWorkflowForEdit(); setBody(event.target.value); }} />
          </label>

          <label className="field">
            <span>Link</span>
            <input type="url" value={link} onChange={(event) => { resetWorkflowForEdit(); setLink(event.target.value); }} placeholder="https://" />
          </label>

          {(contentType === 'image' || contentType === 'video') ? (
            <label className="field">
              <span>{contentType === 'image' ? 'Image file' : 'Video file'}</span>
              <input
                type="file"
                accept={contentType === 'image' ? 'image/*' : 'video/*'}
                onChange={(event) => selectAttachment(event.target.files?.[0] ?? null)}
              />
            </label>
          ) : null}

          <div className="action-row">
            <button className="action-button" type="button" onClick={saveDraft}>Save draft</button>
            <button className="action-button secondary" type="button" onClick={markReady} disabled={!current || current.status !== 'draft'}>Mark ready</button>
          </div>

          <button
            className="action-button full-width"
            type="button"
            onClick={startHandoff}
            disabled={!current || current.status !== 'ready'}
          >
            Open WhatsApp Channel to publish
          </button>

          {current?.status === 'awaiting_manual_publish' ? (
            <div className="confirmation-panel">
              <label className="field">
                <span>WhatsApp update reference</span>
                <input value={providerReference} onChange={(event) => setProviderReference(event.target.value)} placeholder="Optional reference" />
              </label>
              <button className="action-button" type="button" onClick={confirmPublished}>I published this update</button>
            </div>
          ) : null}

          {error ? <div className="form-error" role="alert">{error}</div> : null}
          <div className="workflow-status" role="status">
            <strong>{statusLabel(current)}</strong>
            <span>{message}</span>
          </div>
        </form>

        <aside className="publish-preview" aria-label="WhatsApp Channel preview">
          <p className="eyebrow">Preview · WhatsApp Channel</p>
          <h2>{destination.name}</h2>
          <div className="channel-preview-card">
            <strong>{title || 'Untitled ATLAS update'}</strong>
            <p>{body || 'Your post text will appear here.'}</p>
            {link ? <span className="preview-link">{link}</span> : null}
            {attachment ? <span className="attachment-chip">{attachment.name} · {attachment.mimeType}</span> : null}
          </div>
          <div className="capability-banner">
            <strong>Manual handoff</strong>
            <span>No verified Channel publishing provider is configured.</span>
          </div>
        </aside>
      </div>
    </section>
  );
}
