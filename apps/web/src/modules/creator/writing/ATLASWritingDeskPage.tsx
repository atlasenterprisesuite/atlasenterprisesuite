import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  assistantProviderSummary,
  getAssistantStatus,
  hasVerifiedAssistantProvider,
  sendAssistantMessage,
  type AssistantStatusResponse
} from '../../../assistant/client';
import './atlas-writing-desk.css';

type FileState = 'idle' | 'reading' | 'ready' | 'error';
type RunState = 'idle' | 'running' | 'success' | 'error';

const QUICK_ACTIONS = [
  {
    icon: 'CL',
    title: 'Cover letter',
    prompt: 'Write a tailored cover letter for this job opening using the source material I provide.'
  },
  {
    icon: 'PRO',
    title: 'Professional rewrite',
    prompt: 'Rewrite this note so it sounds concise, polished, and professional while preserving the meaning.'
  },
  {
    icon: 'MSG',
    title: 'Friendly message',
    prompt: 'Write a friendly, respectful message from these notes. Keep it clear and easy to send.'
  }
] as const;

const TEXT_FILE_EXTENSIONS = ['.txt', '.md', '.csv', '.json', '.html', '.htm', '.xml', '.rtf'];

function isTextFile(file: File) {
  const lowerName = file.name.toLowerCase();
  return file.type.startsWith('text/') || TEXT_FILE_EXTENSIONS.some(extension => lowerName.endsWith(extension));
}

async function extractImageNotes(file: File) {
  const TextDetectorCtor = (globalThis as unknown as {
    TextDetector?: new () => { detect(source: ImageBitmap): Promise<Array<{ rawValue?: string }>> };
  }).TextDetector;
  if (!TextDetectorCtor || typeof createImageBitmap !== 'function') {
    throw new Error('image_ocr_not_supported');
  }
  const bitmap = await createImageBitmap(file);
  try {
    const blocks = await new TextDetectorCtor().detect(bitmap);
    return blocks.map(block => String(block.rawValue || '').trim()).filter(Boolean).join('\n');
  } finally {
    bitmap.close();
  }
}

export function ATLASWritingDeskPage() {
  const [status, setStatus] = useState<AssistantStatusResponse | null>(null);
  const [instruction, setInstruction] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [output, setOutput] = useState('');
  const [language, setLanguage] = useState<'English' | 'Spanish'>('English');
  const [tone, setTone] = useState('Professional');
  const [fileName, setFileName] = useState('');
  const [fileState, setFileState] = useState<FileState>('idle');
  const [runState, setRunState] = useState<RunState>('idle');
  const [notice, setNotice] = useState('');
  const sourceRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    let active = true;
    getAssistantStatus()
      .then(next => {
        if (!active) return;
        setStatus(next);
        setNotice('');
      })
      .catch(error => {
        if (!active) return;
        setStatus(null);
        setNotice(error instanceof Error ? error.message : 'assistant_status_unavailable');
      });
    return () => { active = false; };
  }, []);

  const providerReady = Boolean(status && hasVerifiedAssistantProvider(status));
  const providerLabel = useMemo(
    () => status ? assistantProviderSummary(status) : 'checking verified providers',
    [status]
  );
  const canRun = providerReady && instruction.trim().length > 0 && runState !== 'running';

  function applyQuickAction(prompt: string) {
    setInstruction(prompt);
    setOutput('');
    setRunState('idle');
    setNotice('Quick action loaded. Add the job details, note, or context below.');
    window.requestAnimationFrame(() => sourceRef.current?.focus());
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setFileName(file.name);
    setFileState('reading');
    setNotice('Reading source file…');
    try {
      if (file.size > 2_000_000) throw new Error('file_too_large');
      let extracted = '';
      if (isTextFile(file)) {
        extracted = await file.text();
      } else if (file.type.startsWith('image/')) {
        extracted = await extractImageNotes(file);
      } else {
        throw new Error('unsupported_file_type');
      }
      const normalized = extracted.replace(/\u0000/g, '').trim().slice(0, 24000);
      if (!normalized) throw new Error('no_text_found');
      setSourceText(normalized);
      setFileState('ready');
      setNotice(`Source imported from ${file.name}. Review it before generating.`);
    } catch (error) {
      setFileState('error');
      const code = error instanceof Error ? error.message : 'file_read_failed';
      if (code === 'image_ocr_not_supported') {
        setNotice('This browser does not expose local image text detection. ATLAS will not pretend OCR succeeded; use a text file or paste the notes.');
      } else if (code === 'unsupported_file_type') {
        setNotice('Unsupported file type. Use TXT, Markdown, CSV, JSON, HTML, XML, RTF, or an image when local OCR is available.');
      } else if (code === 'file_too_large') {
        setNotice('The file is larger than the 2 MB local extraction limit.');
      } else if (code === 'no_text_found') {
        setNotice('No readable text was found in that file.');
      } else {
        setNotice(code);
      }
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canRun) return;
    setRunState('running');
    setOutput('');
    setNotice('');
    const source = sourceText.trim();
    const prompt = [
      'ATLAS Writing Desk task.',
      `Output language: ${language}.`,
      `Requested tone: ${tone}.`,
      'Produce a finished draft only. Preserve facts supplied by the user and do not invent names, dates, credentials, job details, promises, or other factual claims.',
      `Instruction: ${instruction.trim()}`,
      source ? `Source material:\n${source}` : 'Source material: none supplied. Ask for missing factual details inside the draft only when they are essential.'
    ].join('\n\n');

    try {
      const result = await sendAssistantMessage({
        message: prompt,
        pathname: '/studio/write',
        modality: 'text'
      });
      setOutput(result.output || result.text || '');
      setRunState('success');
      setNotice(`Draft created via ${result.provider || 'ATLAS'}${result.model ? ` · ${result.model}` : ''}.`);
    } catch (error) {
      setRunState('error');
      setNotice(error instanceof Error ? error.message : 'writing_request_failed');
    }
  }

  async function copyDraft() {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setNotice('Draft copied to the clipboard.');
    } catch {
      setNotice('Clipboard access was blocked by the browser.');
    }
  }

  function startOver() {
    setInstruction('');
    setSourceText('');
    setOutput('');
    setFileName('');
    setFileState('idle');
    setRunState('idle');
    setNotice('');
  }

  return <section className="creator-page atlas-writing-page">
    <nav className="creator-breadcrumb" aria-label="Breadcrumb">
      <Link to="/studio">ATLAS Studio</Link><span>/</span><span>Writing Desk</span>
    </nav>

    <header className="atlas-writing-hero">
      <div>
        <p className="eyebrow">ATLAS Studio · Writing Desk</p>
        <h1>Turn notes, prompts, and files into finished drafts.</h1>
        <p>Use governed ATLAS intelligence for writing while keeping provider readiness, source text, and unsupported file extraction explicit.</p>
      </div>
      <div className={providerReady ? 'atlas-writing-readiness ready' : 'atlas-writing-readiness'}>
        <span>{providerReady ? 'Verified AI ready' : 'AI unavailable'}</span>
        <strong>{providerLabel}</strong>
      </div>
    </header>

    <section className="atlas-writing-quick-section" aria-labelledby="writing-quick-actions">
      <div className="atlas-writing-section-heading">
        <div><p className="eyebrow">Start quickly</p><h2 id="writing-quick-actions">Useful ways to write with ATLAS</h2></div>
        <span>Each action remains editable before anything is sent.</span>
      </div>
      <div className="atlas-writing-quick-grid">
        {QUICK_ACTIONS.map(action => <button type="button" key={action.title} onClick={() => applyQuickAction(action.prompt)}>
          <span className="atlas-writing-icon" aria-hidden="true">{action.icon}</span>
          <span><strong>{action.title}</strong><small>{action.prompt}</small></span>
          <span className="atlas-writing-arrow" aria-hidden="true">→</span>
        </button>)}
      </div>
    </section>

    <div className="atlas-writing-workspace">
      <form className="atlas-writing-composer" onSubmit={submit}>
        <div className="atlas-writing-section-heading compact">
          <div><p className="eyebrow">Compose</p><h2>Writing request</h2></div>
          <button type="button" className="atlas-writing-text-button" onClick={startOver}>Clear</button>
        </div>

        <label>
          <span>What should ATLAS write?</span>
          <textarea rows={4} value={instruction} onChange={event => setInstruction(event.target.value)} placeholder="Describe the draft, rewrite, letter, message, summary, or other writing task…" />
        </label>

        <label>
          <span>Source notes or existing text</span>
          <textarea ref={sourceRef} rows={9} value={sourceText} onChange={event => setSourceText(event.target.value)} placeholder="Paste the source text here, or import a supported file below." />
        </label>

        <div className="atlas-writing-options">
          <label><span>Output language</span><select value={language} onChange={event => setLanguage(event.target.value as 'English' | 'Spanish')}><option>English</option><option>Spanish</option></select></label>
          <label><span>Tone</span><select value={tone} onChange={event => setTone(event.target.value)}><option>Professional</option><option>Friendly</option><option>Concise</option><option>Formal</option><option>Persuasive</option><option>Warm</option></select></label>
        </div>

        <label className="atlas-writing-upload">
          <span className="atlas-writing-upload-title">Turn a file into source text</span>
          <span>TXT, Markdown, CSV, JSON, HTML, XML, RTF, or an image when the browser provides local OCR.</span>
          <input
            type="file"
            accept=".txt,.md,.csv,.json,.html,.htm,.xml,.rtf,text/*,image/*"
            onChange={event => handleFile(event.target.files?.[0])}
          />
          <strong>{fileState === 'reading' ? 'Reading…' : fileName || 'Choose a file'}</strong>
        </label>

        <button className="creator-primary" type="submit" disabled={!canRun}>
          {runState === 'running' ? 'Writing…' : providerReady ? 'Create draft' : 'Verified AI required'}
        </button>
        {notice && <p className={runState === 'error' || fileState === 'error' ? 'atlas-writing-notice error' : 'atlas-writing-notice'} role="status">{notice}</p>}
      </form>

      <aside className="atlas-writing-output" aria-live="polite">
        <div className="atlas-writing-section-heading compact">
          <div><p className="eyebrow">Draft</p><h2>Ready to refine</h2></div>
          <button type="button" className="atlas-writing-text-button" onClick={copyDraft} disabled={!output}>Copy</button>
        </div>
        {runState === 'running' ? <div className="atlas-writing-empty"><strong>Creating your draft…</strong><span>ATLAS is using a server-verified provider.</span></div>
          : output ? <pre>{output}</pre>
            : <div className="atlas-writing-empty"><strong>No draft yet</strong><span>Choose a quick action or describe what you want to write.</span></div>}
        <div className="atlas-writing-boundary">
          <strong>Source-aware by design</strong>
          <span>ATLAS does not claim document parsing, OCR, or AI readiness unless the current browser and server actually support it.</span>
        </div>
      </aside>
    </div>
  </section>;
}
