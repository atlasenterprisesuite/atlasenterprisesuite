import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Link } from 'react-router-dom';
import type { WebLaunchProfile } from '../../../../../../packages/creator/web_launch';
import {
  buildBrandExperiencePack,
  renderBrandExperienceText
} from '../../../../../../packages/creator/brand_experience';
import { buildBrandQr, renderBrandQrSvg } from '../../../../../../packages/creator/brand_qr';
import {
  MAX_PHOTO360_FRAMES,
  photo360Readiness,
  nextPhoto360Frame,
  validatePhoto360Files
} from '../../../../../../packages/creator/brand_360';
import './brand-experience.css';

type LocalFrame = { id: number; src: string; name: string; type: string; size: number };

export function BrandExperiencePanel({ profile }: { profile: WebLaunchProfile }) {
  const [productName, setProductName] = useState('');
  const [founderStory, setFounderStory] = useState('');
  const [destinationUrl, setDestinationUrl] = useState('');
  const [frames, setFrames] = useState<LocalFrame[]>([]);
  const [activeFrame, setActiveFrame] = useState(0);
  const [frameError, setFrameError] = useState('');
  const [exportMessage, setExportMessage] = useState('');
  const [confirmed360, setConfirmed360] = useState(false);
  const [qrPreviewUrl, setQrPreviewUrl] = useState<string | null>(null);
  const dragStartX = useRef<number | null>(null);
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
  const qr = useMemo(() => pack?.destination ? buildBrandQr(pack.destination) : null, [pack?.destination]);
  const photoStatus = photo360Readiness(frames, confirmed360);

  useEffect(() => {
    if (!qr) { setQrPreviewUrl(null); return; }
    const url = URL.createObjectURL(new Blob([renderBrandQrSvg(qr)], { type: 'image/svg+xml' }));
    setQrPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [qr]);

  function startRotate(event: ReactPointerEvent<HTMLDivElement>) {
    dragStartX.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function endRotate(event: ReactPointerEvent<HTMLDivElement>) {
    if (dragStartX.current === null) return;
    const delta = Math.trunc((event.clientX - dragStartX.current) / 20);
    dragStartX.current = null;
    if (delta) setActiveFrame(current => nextPhoto360Frame(current, frames.length, -delta));
  }

  function addFrames(files: FileList | null) {
    if (!files?.length) return;
    const incoming = Array.from(files);
    const manifest = [...frames, ...incoming].map(file => ({ name: file.name, type: file.type, size: file.size }));
    const problem = validatePhoto360Files(manifest);
    if (problem) { setFrameError(problem); return; }
    const added: LocalFrame[] = incoming.map(file => {
      const src = URL.createObjectURL(file);
      objectUrls.current.add(src);
      return { id: ++nextFrameId.current, src, name: file.name, type: file.type, size: file.size };
    });
    setFrames(current => [...current, ...added].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })));
    setActiveFrame(0);
    setConfirmed360(false);
    setFrameError('');
  }

  function clearFrames() {
    frames.forEach(frame => {
      URL.revokeObjectURL(frame.src);
      objectUrls.current.delete(frame.src);
    });
    setFrames([]);
    setActiveFrame(0);
    setConfirmed360(false);
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
              : <p className="brand-experience__proof">Enter a public HTTPS product URL to prepare an offline QR draft.</p>}
            {qr && qrPreviewUrl ? <div className="brand-experience__qr">
              <h4>Offline QR · medium error correction</h4>
              <img src={qrPreviewUrl} width="224" height="224" alt="QR code leading to the exact displayed product HTTPS URL" />
              <p className="brand-experience__qr-destination">{qr.destination}</p>
              <a className="creator-secondary" href={qrPreviewUrl} download="atlas-product-qr.svg">Download printable SVG QR</a>
              <p className="brand-experience__proof">Check the destination and scan the exported code before printing. No shortener, tracking, redirect, or external QR provider was used. ATLAS cannot independently certify ownership or safety of the destination website.</p>
            </div> : pack.destination ? <p className="brand-experience__alert" role="status">Link exceeds offline QR capacity (version 10 maximum). Use a shorter public HTTPS product URL you control.</p> : null}
          </> : <p>Provide the real business details to see a preview. All text remains editable.</p>}
        </div>
      </div>
      <div className="brand-experience__frames">
        <div>
          <h3>Product photographic 360° viewer</h3>
          <p>Upload 12–36 real, ordered photographs covering one full turn of the same product with a fixed camera. Files sort by natural filename order (frame-1, frame-2…). Fewer than 12 frames remain a multi-angle preview. This is not a generated 3D mesh.</p>
        </div>
        <label className="brand-experience__upload">
          Add photos (maximum 36, 6 MB each, 96 MB total)
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => { addFrames(event.target.files); event.target.value = ''; }} />
        </label>
        {frameError ? <p className="brand-experience__alert" role="alert">{frameError}</p> : null}
        {frames.length >= 12 ? <label className="brand-experience__confirm">
          <input type="checkbox" checked={confirmed360} onChange={event => setConfirmed360(event.target.checked)} />
          I confirm these ordered photos capture one complete 360° rotation of the same product.
        </label> : null}
        <p className="brand-experience__status" role="status">
          {photoStatus === 'photo-360-confirmed' ? 'Photographic 360° sequence · user-confirmed (not a 3D mesh)' : 'Multi-angle preview · not verified as a complete 360° turn'}
        </p>
        {frames.length > 0 ? <div className="brand-experience__viewer">
          <div className="brand-experience__rotation" role="slider" tabIndex={0}
            aria-label="Rotate product photographic sequence" aria-valuemin={1} aria-valuemax={frames.length}
            aria-valuenow={Math.min(activeFrame, frames.length - 1) + 1}
            aria-valuetext={'Product view ' + (Math.min(activeFrame, frames.length - 1) + 1) + ' of ' + frames.length}
            onPointerDown={startRotate} onPointerUp={endRotate} onPointerCancel={() => { dragStartX.current = null; }}
            onKeyDown={event => {
              if (event.key === 'ArrowLeft') { event.preventDefault(); setActiveFrame(current => nextPhoto360Frame(current, frames.length, -1)); }
              if (event.key === 'ArrowRight') { event.preventDefault(); setActiveFrame(current => nextPhoto360Frame(current, frames.length, 1)); }
              if (event.key === 'Home') { event.preventDefault(); setActiveFrame(0); }
              if (event.key === 'End') { event.preventDefault(); setActiveFrame(frames.length - 1); }
            }}>
            <img draggable={false} src={frames[Math.min(activeFrame, frames.length - 1)].src}
              alt={'Product angle ' + (Math.min(activeFrame, frames.length - 1) + 1) + ' of ' + frames.length + ': ' + frames[Math.min(activeFrame, frames.length - 1)].name} />
          </div>
          <div className="brand-experience__viewer-controls">
            <button type="button" onClick={() => setActiveFrame(current => nextPhoto360Frame(current, frames.length, -1))} aria-label="Previous product view">←</button>
            <label><span>View {Math.min(activeFrame, frames.length - 1) + 1} of {frames.length}</span>
              <input aria-label="Select product view" type="range" min={0} max={frames.length - 1} step={1} value={Math.min(activeFrame, frames.length - 1)} onChange={event => setActiveFrame(Number(event.target.value))} disabled={frames.length < 2} />
            </label>
            <button type="button" onClick={() => setActiveFrame(current => nextPhoto360Frame(current, frames.length, 1))} aria-label="Next product view">→</button>
            <button type="button" onClick={clearFrames}>Clear photos</button>
            <span className="brand-experience__proof">Drag or swipe the product; or use keyboard arrows, Home and End.</span>
          </div>
        </div> : <p className="brand-experience__empty">No product photos selected. Photos stay on this device during the session and are never automatically uploaded.</p>}
      </div>
    </section>
  );
}
