import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCreatorAssetPreview, listCreatorAssets } from '../../../lib/creatorApi';

type CreatorAssetRecord = Awaited<ReturnType<typeof listCreatorAssets>>[number];
type Axis = 'vertical' | 'horizontal';
type FitMode = 'cover' | 'contain';

const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function ScrollVideoComposer() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [assets, setAssets] = useState<CreatorAssetRecord[]>([]);
  const [libraryState, setLibraryState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [previewState, setPreviewState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [selectedId, setSelectedId] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [message, setMessage] = useState('');
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [axis, setAxis] = useState<Axis>('vertical');
  const [reverse, setReverse] = useState(false);
  const [smoothing, setSmoothing] = useState(0.35);
  const [fit, setFit] = useState<FitMode>('cover');
  const [showPoster, setShowPoster] = useState(true);

  useEffect(() => {
    let active = true;
    listCreatorAssets()
      .then(rows => {
        if (!active) return;
        setAssets(rows.filter(row => row.mediaType === 'video'));
        setLibraryState('ready');
      })
      .catch(error => {
        if (!active) return;
        setLibraryState('error');
        setMessage(error instanceof Error ? error.message : 'creator_library_unavailable');
      });
    return () => { active = false; };
  }, []);

  const selectedAsset = useMemo(
    () => assets.find(asset => asset.id === selectedId) || null,
    [assets, selectedId]
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !duration) return;
    const target = duration * progress;
    if (Math.abs(video.currentTime - target) > 0.015) video.currentTime = target;
  }, [duration, progress]);

  async function selectAsset(assetId: string) {
    setSelectedId(assetId);
    setProgress(0);
    setDuration(0);
    setPreviewUrl('');
    setMessage('');
    if (!assetId) {
      setPreviewState('idle');
      return;
    }

    setPreviewState('loading');
    try {
      const preview = await getCreatorAssetPreview(assetId);
      setPreviewUrl(preview.signed_url);
      setPreviewState('ready');
      setMessage('Secure preview ready. The signed URL is short-lived and organization-scoped.');
    } catch (error) {
      setPreviewState('error');
      setMessage(error instanceof Error ? error.message : 'asset_preview_unavailable');
    }
  }

  function updateProgress(next: number) {
    setProgress(clamp(next));
  }

  function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (!previewUrl || !duration) return;
    event.preventDefault();
    const rawDelta = axis === 'vertical'
      ? event.deltaY
      : (Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY);
    const direction = reverse ? -1 : 1;
    const sensitivity = 0.00045 + (1 - smoothing) * 0.0012;
    updateProgress(progress + rawDelta * sensitivity * direction);
  }

  const percent = Math.round(progress * 100);

  return <section className="scroll-video-composer" aria-labelledby="scroll-video-title">
    <div className="scroll-video-heading">
      <div>
        <p className="eyebrow">Motion prototype · Creator Library first</p>
        <h3 id="scroll-video-title">Scroll-scrub video experience</h3>
        <p>Recreates the interaction pattern from the supplied reference without copying its media or third-party UI. Select an approved ATLAS video, then scrub the timeline with wheel/trackpad or the accessible timeline control.</p>
      </div>
      <span className={'scroll-video-state ' + previewState} role="status">
        {previewState === 'loading' ? 'Preparing preview…' : previewState === 'ready' ? 'Interactive preview ready' : previewState === 'error' ? 'Preview blocked' : 'Choose an asset'}
      </span>
    </div>

    <div className="scroll-video-grid">
      <div className="scroll-video-stage" onWheel={handleWheel}>
        {previewUrl ? (
          <video
            ref={videoRef}
            src={previewUrl}
            muted
            playsInline
            preload="metadata"
            className={'scroll-video-player fit-' + fit}
            aria-label="Selected Creator Library video preview"
            onLoadedMetadata={event => {
              const nextDuration = Number(event.currentTarget.duration || 0);
              setDuration(Number.isFinite(nextDuration) ? nextDuration : 0);
              event.currentTarget.pause();
              event.currentTarget.currentTime = 0;
            }}
          />
        ) : (
          <div className="scroll-video-placeholder">
            <span className="scroll-video-orbit" aria-hidden="true" />
            <strong>{libraryState === 'loading' ? 'Loading Creator Library…' : assets.length ? 'Select a video asset' : 'No approved video assets found'}</strong>
            <span>{assets.length ? 'ATLAS will request a short-lived preview only after selection.' : 'Create or import an approved video in Creator Studio before building the interaction.'}</span>
            {!assets.length && libraryState === 'ready' ? <Link to="/studio/library">Open Creator Library</Link> : null}
          </div>
        )}

        {previewUrl && showPoster && percent === 0 ? <div className="scroll-video-poster-label">Start frame</div> : null}
        {previewUrl ? <div className="scroll-video-progress" aria-hidden="true"><span style={{ width: percent + '%' }} /></div> : null}
      </div>

      <aside className="scroll-video-controls" aria-label="Scroll video controls">
        <label>
          <span>Creator Library video</span>
          <select value={selectedId} onChange={event => void selectAsset(event.target.value)} disabled={libraryState !== 'ready'}>
            <option value="">{libraryState === 'loading' ? 'Loading…' : libraryState === 'error' ? 'Library unavailable' : 'Select video'}</option>
            {assets.map(asset => <option key={asset.id} value={asset.id}>
              {(asset.providerId || 'ATLAS') + ' · ' + (asset.durationSeconds ? Math.round(asset.durationSeconds) + 's' : 'video') + ' · ' + asset.id.slice(0, 8)}
            </option>)}
          </select>
        </label>

        <fieldset>
          <legend>Scroll axis</legend>
          <button type="button" className={axis === 'vertical' ? 'active' : ''} aria-pressed={axis === 'vertical'} onClick={() => setAxis('vertical')}>Vertical</button>
          <button type="button" className={axis === 'horizontal' ? 'active' : ''} aria-pressed={axis === 'horizontal'} onClick={() => setAxis('horizontal')}>Horizontal</button>
        </fieldset>

        <label className="scroll-video-toggle">
          <input type="checkbox" checked={reverse} onChange={event => setReverse(event.target.checked)} />
          <span>Reverse direction</span>
        </label>

        <label>
          <span>Smoothing · {Math.round(smoothing * 100)}%</span>
          <input aria-label="Scroll smoothing" type="range" min="0" max="1" step="0.05" value={smoothing} onChange={event => setSmoothing(Number(event.target.value))} />
        </label>

        <fieldset>
          <legend>Video fit</legend>
          <button type="button" className={fit === 'cover' ? 'active' : ''} aria-pressed={fit === 'cover'} onClick={() => setFit('cover')}>Cover</button>
          <button type="button" className={fit === 'contain' ? 'active' : ''} aria-pressed={fit === 'contain'} onClick={() => setFit('contain')}>Contain</button>
        </fieldset>

        <label className="scroll-video-toggle">
          <input type="checkbox" checked={showPoster} onChange={event => setShowPoster(event.target.checked)} />
          <span>Show start-frame marker</span>
        </label>

        <label>
          <span>Timeline · {percent}%</span>
          <input
            aria-label="Timeline progress"
            type="range"
            min="0"
            max="100"
            step="1"
            value={percent}
            disabled={!previewUrl || !duration}
            onChange={event => updateProgress(Number(event.target.value) / 100)}
          />
        </label>

        <div className="scroll-video-meta">
          <span>Asset</span><strong>{selectedAsset ? selectedAsset.id.slice(0, 12) : 'None'}</strong>
          <span>Duration</span><strong>{duration ? duration.toFixed(1) + 's' : '—'}</strong>
          <span>Progress</span><strong>{percent}%</strong>
        </div>
      </aside>
    </div>

    {message ? <p className={'scroll-video-message ' + (previewState === 'error' ? 'error' : '')} role={previewState === 'error' ? 'alert' : 'status'}>{message}</p> : null}
  </section>;
}
