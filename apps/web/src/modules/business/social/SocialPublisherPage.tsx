import { useMemo, useState, type CSSProperties } from 'react';
import {
  getPlatform,
  socialPlatforms,
  validateMedia,
  type PlatformId
} from '../../../../../../packages/social/src/platforms';

type MediaPreview = { file: File; url: string };

export function SocialPublisherPage() {
  const [platformId, setPlatformId] = useState<PlatformId>('instagram');
  const platform = getPlatform(platformId);
  const [formatId, setFormatId] = useState(platform.formats[0].id);
  const [caption, setCaption] = useState('');
  const [media, setMedia] = useState<MediaPreview[]>([]);
  const format = platform.formats.find((item) => item.id === formatId) ?? platform.formats[0];
  const errors = useMemo(() => validateMedia(media.map((item) => item.file), format), [media, format]);

  function selectPlatform(nextId: PlatformId) {
    const next = getPlatform(nextId);
    setPlatformId(nextId);
    setFormatId(next.formats[0].id);
  }

  function addMedia(files: FileList | null) {
    if (!files) return;
    const next = Array.from(files).map((file) => ({ file, url: URL.createObjectURL(file) }));
    setMedia((current) => [...current, ...next]);
  }

  function removeMedia(index: number) {
    setMedia((current) => {
      URL.revokeObjectURL(current[index].url);
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  const publishDisabled = platform.connectionStatus === 'not_configured' || media.length === 0 || errors.length > 0;

  return (
    <section className="page-stack social-publisher">
      <header className="page-header split-header">
        <div>
          <p className="eyebrow">Business Suite · Growth</p>
          <h1>Social Publisher</h1>
          <p>Prepare one campaign and validate every photo or video against its destination format.</p>
        </div>
        <span className="status-chip warning">Draft workspace</span>
      </header>

      <div className="platform-tabs" role="tablist" aria-label="Social platforms">
        {socialPlatforms.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === platformId}
            className={item.id === platformId ? 'platform-tab active' : 'platform-tab'}
            style={{ '--platform-accent': item.accent } as CSSProperties}
            onClick={() => selectPlatform(item.id)}
          >
            {item.name}
          </button>
        ))}
      </div>

      <div className="publisher-grid">
        <article className="workspace-card composer-panel">
          <div className="card-heading">
            <div><p className="eyebrow">Creative Studio</p><h2>Compose content</h2></div>
            <span className="status-chip neutral">{platform.name}</span>
          </div>

          <label className="field">
            <span>Platform format</span>
            <select value={format.id} onChange={(event) => setFormatId(event.target.value)}>
              {platform.formats.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label} · {item.aspectRatio} · {item.width}×{item.height}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Caption</span>
            <textarea value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Write the message for this platform…" rows={6} />
          </label>

          <label className="media-dropzone">
            <strong>Add photos or videos</strong>
            <span>Accepted for {format.label}: {format.media.join(' or ')} · up to {format.maxFiles} file(s)</span>
            <input
              type="file"
              accept={format.media.map((kind) => `${kind}/*`).join(',')}
              multiple={format.maxFiles > 1}
              onChange={(event) => addMedia(event.target.files)}
            />
          </label>

          {media.length > 0 && (
            <div className="media-queue">
              {media.map((item, index) => (
                <article key={`${item.file.name}-${index}`}>
                  {item.file.type.startsWith('video/')
                    ? <video src={item.url} muted controls />
                    : <img src={item.url} alt={item.file.name} />}
                  <div><strong>{item.file.name}</strong><small>{(item.file.size / 1024 / 1024).toFixed(2)} MB</small></div>
                  <button type="button" onClick={() => removeMedia(index)} aria-label={`Remove ${item.file.name}`}>Remove</button>
                </article>
              ))}
            </div>
          )}

          {errors.length > 0 && <div className="validation-errors" role="alert">{errors.map((error) => <span key={error}>{error}</span>)}</div>}

          <div className="publisher-actions">
            <button className="secondary-button" type="button" onClick={() => { media.forEach((item) => URL.revokeObjectURL(item.url)); setCaption(''); setMedia([]); }}>Clear draft</button>
            <button className="primary-button" type="button" disabled={publishDisabled}>Publish to {platform.name}</button>
          </div>
          <div className="connection-gate">
            <strong>Publishing connection required</strong>
            <span>{platform.name} credentials and organization authorization are not configured. Drafting and format validation remain available.</span>
          </div>
        </article>

        <aside className="workspace-card preview-panel">
          <div><p className="eyebrow">Live preview</p><h2>{format.label}</h2><span>{format.width} × {format.height}px · {format.aspectRatio}</span></div>
          <div className="social-frame" style={{ aspectRatio: format.aspectRatio.replace(':', ' / ') }}>
            {media[0]
              ? media[0].file.type.startsWith('video/')
                ? <video src={media[0].url} muted controls />
                : <img src={media[0].url} alt="Selected creative preview" />
              : <div className="preview-empty"><strong>No media selected</strong><span>Your first compatible asset will appear here.</span></div>}
          </div>
          {caption && <p className="preview-caption">{caption}</p>}
        </aside>
      </div>
    </section>
  );
}
