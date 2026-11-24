import { useMemo, useState } from 'react';
import type { ProductionSpec } from '../../../../../../packages/creator/types';
import {
  compileAvatar6Handoff,
  type Avatar6AspectRatio,
  type Avatar6Engine
} from '../../../../../../packages/creator/avatar6';

const SUPPORTED_RATIOS = new Set(['16:9', '9:16', '1:1', '4:5', '5:4']);
const HEYGEN_SCRIPT_TO_VIDEO = 'https://app.heygen.com/appws/script-to-video';

/**
 * In-browser preparation only. This panel never uploads biometric references,
 * checks provider credentials, initiates video generation or spends credits.
 */
export function Avatar6HandoffPanel({ spec }: { spec: ProductionSpec }) {
  const [title, setTitle] = useState(spec.title || 'ATLAS avatar presentation');
  const [script, setScript] = useState(spec.audioPlan.dialogue.join('\n\n'));
  const [engine, setEngine] = useState<Avatar6Engine>('turbo');
  const [language, setLanguage] = useState<'es' | 'en'>('es');
  const [aspectRatio, setAspectRatio] = useState<Avatar6AspectRatio>(
    SUPPORTED_RATIOS.has(spec.aspectRatio) ? spec.aspectRatio as Avatar6AspectRatio : 'auto'
  );
  const [motionPrompt, setMotionPrompt] = useState('');
  const [copyState, setCopyState] = useState('');

  const prepared = useMemo(() => {
    try {
      return { value: compileAvatar6Handoff({ title, script, engine, language, aspectRatio, motionPrompt }), error: '' };
    } catch (error) {
      return { value: null, error: error instanceof Error ? error.message : 'avatar6_draft_invalid' };
    }
  }, [title, script, engine, language, aspectRatio, motionPrompt]);

  async function copyHandoff() {
    if (!prepared.value) return;
    if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
      setCopyState('Clipboard unavailable. Select and copy the JSON manually.');
      return;
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(prepared.value, null, 2));
      setCopyState('Handoff copied. No data was sent to HeyGen.');
    } catch {
      setCopyState('Clipboard access was denied. Select and copy the JSON manually.');
    }
  }

  return <section className="director-provider-card" aria-labelledby="atlas-avatar6-heading">
    <p className="eyebrow">Optional provider handoff · not connected</p>
    <h3 id="atlas-avatar6-heading">HeyGen Avatar 6 · Personal Presenter</h3>
    <p>Prepare a script and accessible video configuration without invoking a paid service. Avatar creation, verified consent, authorization and generation happen separately in HeyGen.</p>
    <p role="note">No biometric media is uploaded or saved by this panel. This draft is local to this open view. The JSON is a planning handoff, not a submitted API request.</p>

    <div className="director-provider-list">
      <label>Presentation title
        <input aria-label="Avatar 6 presentation title" value={title} maxLength={140} onChange={event => { setTitle(event.target.value); setCopyState(''); }} />
      </label>
      <label>Exact spoken script
        <textarea aria-label="Avatar 6 exact spoken script" value={script} rows={6} onChange={event => { setScript(event.target.value); setCopyState(''); }} placeholder="Write exactly what the avatar should say." />
      </label>
      <label>Delivery instructions (optional)
        <textarea aria-label="Avatar 6 motion instructions" value={motionPrompt} rows={2} maxLength={500} onChange={event => { setMotionPrompt(event.target.value); setCopyState(''); }} placeholder="Example: calm, occasional natural gestures" />
      </label>
      <label>Engine
        <select aria-label="Avatar 6 engine" value={engine} onChange={event => setEngine(event.target.value as Avatar6Engine)}>
          <option value="turbo">Avatar 6 Turbo · prefer fewer credits</option>
          <option value="pro">Avatar 6 Pro · higher credit use</option>
        </select>
      </label>
      <label>Script language (metadata only — choose a compatible voice in HeyGen)
        <select aria-label="Avatar 6 spoken language" value={language} onChange={event => setLanguage(event.target.value as 'es' | 'en')}>
          <option value="es">Spanish</option><option value="en">English</option>
        </select>
      </label>
      <label>Aspect ratio
        <select aria-label="Avatar 6 aspect ratio" value={aspectRatio} onChange={event => setAspectRatio(event.target.value as Avatar6AspectRatio)}>
          <option value="auto">Automatic</option><option value="9:16">9:16 · Vertical</option>
          <option value="16:9">16:9 · Horizontal</option><option value="1:1">1:1 · Square</option>
          <option value="4:5">4:5</option><option value="5:4">5:4</option>
        </select>
      </label>
    </div>
    {prepared.error && <p role="alert">Draft validation: {prepared.error}</p>}
    {prepared.value && <>
      <label htmlFor="atlas-avatar6-json">Provider-neutral JSON handoff (read-only)</label>
      <textarea id="atlas-avatar6-json" aria-label="Avatar 6 read-only JSON handoff" readOnly rows={8} value={JSON.stringify(prepared.value, null, 2)} />
      <div className="director-navigation">
        <button className="director-action secondary" type="button" onClick={copyHandoff}>Copy handoff</button>
        <a className="director-action" href={HEYGEN_SCRIPT_TO_VIDEO} target="_blank" rel="noopener noreferrer">Open HeyGen Script to Video</a>
      </div>
    </>}
    {copyState && <p role="status">{copyState}</p>}
    <p role="note">Selecting Spanish or English organizes this draft; it does not select a verified HeyGen voice or voice locale. Check the actual speaking voice and pronunciation in HeyGen before generating.</p>
    <p className="director-context-note">Rendering stays unavailable in ATLAS until the server verifies identity and avatar consent, tenant ownership, creator.generate permission, provider readiness, a durable idempotency reservation and per-render credit approval. AI-generated media must be disclosed, with captions and a transcript.</p>
  </section>;
}
