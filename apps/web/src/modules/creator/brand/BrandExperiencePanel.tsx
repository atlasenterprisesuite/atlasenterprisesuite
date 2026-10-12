import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { WebLaunchProfile } from '../../../../../../packages/creator/web_launch';
import {
  buildBrandExperiencePack,
  renderBrandExperienceText
} from '../../../../../../packages/creator/brand_experience';
import './brand-experience.css';

type LocalFrame = { id: number; src: string; name: string };
const MAX_FRAMES = 12;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function BrandExperiencePanel({ profile }: { profile: WebLaunchProfile }) {
  const [productName, setProductName] = useState('');
  const [founderStory, setFounderStory] = useState('');
  const [destinationUrl, setDestinationUrl] = useState('');
  const [frames, setFrames] = useState<LocalFrame[]>([]);
  const [activeFrame, setActiveFrame] = useState(0);
  const [frameError, setFrameError] = useState('');
  const [exportMessage, setExportMessage] = useState('');
  const nextFrameId = useRef(0);
  const objectUrls = useRef(new Set<string>());

  useEffect(() => () => {
    objectUrls.current.forEach(url => URL.revokeObjectURL(url));
    objectUrls.current.clear();
  }, []);

  const result = useMemo(
    () => buildBrandExperiencePack(profile, { productName, founderStory, destinationUrl }),
    [profile, productName, founderStory, destinationUrl]
  );
  const pack = result.pack;

  function addFrames(files: FileList | null) {
    if (!files?.length) return;
    const remaining = Math.max(0, MAX_FRAMES - frames.length);
    const incoming = Array.from(files);
    if (incoming.length > remaining) {
      setFrameError(`Maximum ${MAX_FRAMES} local frames; ${remaining} slot(s) available.`);
      return;
    }
    if (incoming.some(file => !ALLOWED_TYPES.has(file.type) || file.size > MAX_FILE_BYTES || file.size === 0)) {
      setFrameError('Use JPEG, PNG or WebP photographs, each larger than 0 and no more than 10 MB.');
      return;
    }
    const added = incoming.map(file => {
      const src = URL.createObjectURL(file);
      objectUrls.current.add(src);
      return { id: ++nextFrameId.current, src, name: file.name };
    });
    setFrames(current => [...current, ...added]);
    setFrameError('');
  }

  function clearFrames() {
    frames.forEach(frame => {
      URL.revokeObjectURL(frame.src);
      objectUrls.current.delete(frame.src);
    });
    setFrames([]);
    setActiveFrame(0);
    setFrameError('');
  }

  function downloadDraft() {
    if (!pack) return;
    const content = renderBrandExperienceText(pack);
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    const element = document.createElement('a');
    element.href = url;
    element.download = 'atlas-brand-experience-draft.txt';
    document.body.appendChild(element);
    element.click();
    element.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExportMessage('Draft downloaded locally. No brand assets or media were saved to the cloud.');
  }

  return (
    <section id="brand-experience" className="brand-experience web-launch-context" aria-labelledby="brand-experience-title">
      <header className="brand-experience__header">
        <div>
          <p className="eyebrow">ATLAS Studio · Brand Experience</p>
          <h2 id="brand-experience-title">Make the product part of the story.</h2>
          <p>Reuse your Web Launch brand profile to draft product storytelling, a thank-you card and social copy. Nothing is posted, uploaded or certified automatically.</p>
        </div>
        <span className="brand-experience__status">Local draft · no provider cost</span>
      </header>
      <div className="brand-experience__layout">
        <div className="brand-experience__editor">
          <h3>Brand context</h3>
          <p>Brand, audience, promise, language, action and supplied proof come from the Web Launch form above.</p>
          <div className="brand-experience__fields">
            <label><span>Product name · required</span><input maxLength={100} value={productName} onChange={event => setProductName(event.target.value)} placeholder="Example: Cloud Runner" /></label>
            <label><span>Public HTTPS product page · optional</span><input type="url" inputMode="url" autoComplete="url" maxLength={2048} value={destinationUrl} onChange={event => setDestinationUrl(event.target.value)} placeholder="https://your-store.com/product" /></label>
            <label className="brand-experience__wide"><span>Authentic founder / product story · optional</span><textarea rows={4} maxLength={1200} value={founderStory} onChange={event => setFounderStory(event.target.value)} placeholder="Write only the history you can substantiate. ATLAS will not invent one." /></label>
          </div>
          {!pack ? <p className="brand-experience__alert" role="status">Complete these fields above to prepare the draft: {result.errors.join(', ')}.</p> : null}
          {result.warnings.length > 0 ? <div className="brand-experience__warning" aria-label="Publication checks">
            <strong>Publication checks</strong>
            <ul>{result.warnings.map(message => <li key={message}>{message}</li>)}</ul>
          </div> : null}
          <div className="brand-experience__actions">
            <button className="creator-primary" type="button" onClick={downloadDraft} disabled={!pack}>Download text draft</button>
            {pack ? <Link className="creator-secondary" to="/business/growth/social-publisher" state={{ atlasContentHandoff: { caption: pack.socialCaption, platform: 'instagram' } }}>Edit in Social Publisher</Link> : null}
            <Link className="creator-secondary" to="/studio/library">Creator Library</Link>
          </div>
          {exportMessage ? <p role="status">{exportMessage}</p> : null}
        </div>
        <div className="brand-experience__preview" aria-live="polite">
          <p className="eyebrow">Preview · draft, not published</p>
          {pack ? <>
            <p className="brand-experience__preview-brand">{pack.brand}</p>
            <h3>{pack.product}</h3>
            <p className="brand-experience__preview-lead">{pack.packagingNote}</p>
            <blockquote>{pack.story}</blockquote>
            <div className="brand-experience__caption"><strong>Social caption</strong><p>{pack.socialCaption}</p></div>
            <p className="brand-experience__proof">{pack.proofReview}</p>
            {pack.destination
              ? <a className="creator-secondary" href={pack.destination} rel="noopener noreferrer" target="_blank">{pack.cta} ↗</a>
              : <p className="brand-experience__proof">Product URL required before a QR handoff. No QR image has been generated.</p>}
          </> : <p>Provide the real business details to see a preview. All text remains editable.</p>}
        </div>
      </div>
      <div className="brand-experience__frames">
        <div>
          <h3>Product multi-angle viewer</h3>
          <p>Use genuine product photos from different angles. This local photo sequence is not a generated 3D model or a certified 360° capture.</p>
        </div>
        <label className="brand-experience__upload">
          Add photos (maximum 12, 10 MB each)
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => { addFrames(event.target.files); event.target.value = ''; }} />
        </label>
        {frameError ? <p className="brand-experience__alert" role="alert">{frameError}</p> : null}
        {frames.length > 0 ? <div className="brand-experience__viewer">
          <img src={frames[Math.min(activeFrame, frames.length - 1)].src} alt={`Product view ${Math.min(activeFrame, frames.length - 1) + 1} of ${frames.length}: ${frames[Math.min(activeFrame, frames.length - 1)].name}`} />
          <div className="brand-experience__viewer-controls">
            <button type="button" onClick={() => setActiveFrame(current => (current + frames.length - 1) % frames.length)} aria-label="Previous product view">←</button>
            <label><span>View {Math.min(activeFrame, frames.length - 1) + 1} of {frames.length}</span>
              <input aria-label="Select product view" type="range" min={0} max={frames.length - 1} step={1} value={Math.min(activeFrame, frames.length - 1)} onChange={event => setActiveFrame(Number(event.target.value))} disabled={frames.length < 2} />
            </label>
            <button type="button" onClick={() => setActiveFrame(current => (current + 1) % frames.length)} aria-label="Next product view">→</button>
            <button type="button" onClick={clearFrames}>Clear photos</button>
          </div>
        </div> : <p className="brand-experience__empty">No product photos selected. Photos stay on this device during the session and are never automatically uploaded.</p>}
      </div>
    </section>
  );
}
