import { useMemo, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { analyzeWeeklySocialMetrics, parseSocialMetrics, type WeeklySocialAnalysis } from '../../../../../../packages/social/src/analytics';
import { buildConversationQuestions, buildFollowerWelcomeMessages, type FollowerWelcomeMessages } from '../../../../../../packages/social/src/drafting';
import { getPlatform, socialPlatforms, validateMedia, type PlatformId } from '../../../../../../packages/social/src/platforms';
import './social-copilot.css';

type SocialTab = 'analyze' | 'engage' | 'publish';
type MediaPreview = { file: File; url: string };

const emptyWelcomes: FollowerWelcomeMessages = { casual: '', valueFirst: '', questionLed: '' };

export function SocialCopilotPage() {
  const [tab, setTab] = useState<SocialTab>('analyze');
  const [metricsInput, setMetricsInput] = useState('');
  const [analysis, setAnalysis] = useState<WeeklySocialAnalysis | null>(null);
  const [metricErrors, setMetricErrors] = useState<string[]>([]);
  const [topic, setTopic] = useState('');
  const [niche, setNiche] = useState('');
  const [audience, setAudience] = useState('');
  const [tone, setTone] = useState('professional');
  const [questions, setQuestions] = useState<string[]>([]);
  const [welcomes, setWelcomes] = useState<FollowerWelcomeMessages>(emptyWelcomes);
  const [platformId, setPlatformId] = useState<PlatformId>('instagram');
  const platform = getPlatform(platformId);
  const [formatId, setFormatId] = useState(platform.formats[0].id);
  const format = platform.formats.find((item) => item.id === formatId) ?? platform.formats[0];
  const [caption, setCaption] = useState('');
  const [media, setMedia] = useState<MediaPreview[]>([]);
  const mediaErrors = useMemo(() => validateMedia(media.map((item) => item.file), format), [media, format]);

  function selectTab(next: SocialTab) {
    setTab(next);
  }

  function runAnalysis() {
    const parsed = parseSocialMetrics(metricsInput);
    if (!parsed.ok) {
      setMetricErrors(parsed.errors);
      setAnalysis(null);
      return;
    }
    setMetricErrors([]);
    setAnalysis(analyzeWeeklySocialMetrics(parsed.posts));
  }

  function generateEngagementDrafts() {
    const input = { topic, niche, audience, tone };
    setQuestions(buildConversationQuestions(input));
    setWelcomes(buildFollowerWelcomeMessages(input));
  }

  function selectPlatform(nextId: PlatformId) {
    const next = getPlatform(nextId);
    clearMedia();
    setPlatformId(nextId);
    setFormatId(next.formats[0].id);
  }

  function addMedia(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files) return;
    const next = Array.from(files).map((file) => ({
      file,
      url: typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : ''
    }));
    setMedia((current) => [...current, ...next]);
    event.target.value = '';
  }

  function revoke(url: string) {
    if (url && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url);
  }

  function removeMedia(index: number) {
    setMedia((current) => {
      revoke(current[index]?.url ?? '');
      return current.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  function clearMedia() {
    setMedia((current) => {
      current.forEach((item) => revoke(item.url));
      return [];
    });
  }

  function clearPublishDraft() {
    clearMedia();
    setCaption('');
  }

  const providerReady = platform.connectionStatus === 'ready';
  const publishExecutionReady = false;
  const publishDisabled = !providerReady || !publishExecutionReady || media.length === 0 || mediaErrors.length > 0;
  const providerStatusLabel = platform.connectionStatus.replace('_', ' ');
  const publishGateTitle = providerReady ? 'Publishing action required' : 'Publishing connection required';
  const publishGateMessage = platform.connectionStatus === 'unavailable'
    ? `${platform.name} publishing is currently unavailable. Drafting and format validation remain available.`
    : providerReady
      ? `${platform.name} is connected, but an audited server-side publish action is not configured in this slice.`
      : `${platform.name} credentials and organization authorization are not configured. Drafting and format validation remain available.`;
  const engagementReady = Boolean(topic.trim() && niche.trim() && audience.trim());

  return (
    <section className="creator-page social-copilot-page">
      <nav className="creator-breadcrumb" aria-label="Breadcrumb"><Link to="/studio">ATLAS Studio</Link><span>/</span><span>Social Copilot</span></nav>
      <header className="creator-hero compact social-hero">
        <div>
          <p className="eyebrow">Creator Studio · Social Intelligence</p>
          <h1>Social Copilot</h1>
          <p>Analyze supplied performance data, draft human engagement and prepare social publishing without inventing metrics or connected states.</p>
        </div>
      </header>

      <div className="social-tabs" role="tablist" aria-label="Social Copilot sections">
        {(['analyze', 'engage', 'publish'] as SocialTab[]).map((item) => (
          <button key={item} type="button" role="tab" aria-selected={tab === item} className={tab === item ? 'active' : ''} onClick={() => selectTab(item)}>
            {item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'analyze' && (
        <section className="social-panel" aria-label="Analyze social performance">
          <div className="social-panel-heading">
            <div><p className="eyebrow">Weekly performance</p><h2>Analyze verified or imported metrics</h2></div>
            <span className="social-state neutral">session data</span>
          </div>
          <p className="social-helper">Enter one post per line: platform,publishedAt,format,hook,reach,engagements,comments,shares. Findings are based only on the rows you provide until an authorized platform integration exists.</p>
          <label className="social-field"><span>Post metrics</span><textarea rows={8} value={metricsInput} onChange={(event) => setMetricsInput(event.target.value)} placeholder="instagram,2026-09-10T14:00:00Z,reel,Strong hook,1000,150,20,10" /></label>
          <div className="social-actions"><button className="creator-primary" type="button" onClick={runAnalysis}>Analyze metrics</button><button className="social-secondary" type="button" onClick={() => { setMetricsInput(''); setMetricErrors([]); setAnalysis(null); }}>Clear</button></div>
          {metricErrors.length > 0 && <div className="social-errors" role="alert">{metricErrors.map((error) => <span key={error}>{error}</span>)}</div>}
          {!analysis && metricErrors.length === 0 && <div className="social-empty"><strong>No verified or imported metrics yet</strong><span>Connect an authorized provider later or import explicit post metrics for this session.</span></div>}
          {analysis && (
            <div className="social-analysis">
              <div className="social-summary"><strong>{analysis.postCount}</strong><span>{analysis.postCount === 1 ? 'imported post' : 'imported posts'}</span></div>
              <dl className="social-findings">
                <div><dt>Best format</dt><dd>{analysis.bestFormat}</dd></div>
                <div><dt>Worst format</dt><dd>{analysis.worstFormat}</dd></div>
                <div><dt>Best hook</dt><dd>{analysis.bestHook}</dd></div>
                <div><dt>Best posting window</dt><dd>{analysis.bestPostingWindow}</dd></div>
              </dl>
              <article className="social-recommendation"><p className="eyebrow">Highest-potential change</p><strong>{analysis.highestPotentialChange}</strong></article>
              <div className="social-experiments"><h3>Next-week experiments</h3>{analysis.experiments.map((experiment, index) => <article key={experiment}><span>{index + 1}</span><p>{experiment}</p></article>)}</div>
            </div>
          )}
        </section>
      )}

      {tab === 'engage' && (
        <section className="social-panel" aria-label="Draft social engagement">
          <div className="social-panel-heading"><div><p className="eyebrow">Engagement</p><h2>Turn context into conversation starters</h2></div><span className="social-state neutral">draft only</span></div>
          <div className="social-form-grid">
            <label className="social-field"><span>Topic</span><input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="AI for payroll" /></label>
            <label className="social-field"><span>Niche</span><input value={niche} onChange={(event) => setNiche(event.target.value)} placeholder="Small business" /></label>
            <label className="social-field"><span>Audience</span><input value={audience} onChange={(event) => setAudience(event.target.value)} placeholder="Operators" /></label>
            <label className="social-field"><span>Tone</span><select value={tone} onChange={(event) => setTone(event.target.value)}><option value="professional">Professional</option><option value="casual">Casual</option><option value="warm">Warm</option><option value="direct">Direct</option></select></label>
          </div>
          <button className="creator-primary" type="button" disabled={!engagementReady} onClick={generateEngagementDrafts}>Generate engagement drafts</button>
          {questions.length === 0 ? <div className="social-empty"><strong>No engagement drafts yet</strong><span>Provide topic, niche and audience. Nothing is sent automatically.</span></div> : <div className="social-engage-results"><section><h3>Conversation questions</h3><ol>{questions.map((question) => <li key={question}>{question}</li>)}</ol></section><section className="welcome-grid"><article><small>Casual welcome</small><p>{welcomes.casual}</p></article><article><small>Value-first welcome</small><p>{welcomes.valueFirst}</p></article><article><small>Question-led welcome</small><p>{welcomes.questionLed}</p></article></section><p className="social-helper">These are draft suggestions. ATLAS has not sent a message to any follower.</p></div>}
        </section>
      )}

      {tab === 'publish' && (
        <section className="social-panel" aria-label="Prepare social publishing">
          <div className="social-panel-heading"><div><p className="eyebrow">Publishing preparation</p><h2>Validate a campaign before connection</h2></div><span className={`social-state ${providerReady ? 'neutral' : 'warning'}`}>{providerStatusLabel}</span></div>
          <div className="platform-tabs" role="tablist" aria-label="Social platforms">
            {socialPlatforms.map((item) => <button key={item.id} type="button" role="tab" aria-selected={item.id === platformId} className={item.id === platformId ? 'active' : ''} onClick={() => selectPlatform(item.id)}>{item.name}</button>)}
          </div>
          <div className="publisher-grid">
            <div className="social-publish-form">
              <label className="social-field"><span>Platform format</span><select value={format.id} onChange={(event) => { clearMedia(); setFormatId(event.target.value); }}>{platform.formats.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.aspectRatio} · {item.width}×{item.height}</option>)}</select></label>
              <label className="social-field"><span>Caption</span><textarea rows={5} value={caption} onChange={(event) => setCaption(event.target.value)} placeholder={`Write the message for ${platform.name}…`} /></label>
              <label className="social-dropzone"><strong>Add photos or videos</strong><span>Accepted: {format.media.join(' or ')} · up to {format.maxFiles} file(s)</span><input type="file" accept={format.media.map((kind) => `${kind}/*`).join(',')} multiple={format.maxFiles > 1} onChange={addMedia} /></label>
              {media.length > 0 && <div className="media-queue">{media.map((item, index) => <article key={`${item.file.name}-${index}`}>{item.url ? item.file.type.startsWith('video/') ? <video src={item.url} muted controls /> : <img src={item.url} alt={item.file.name} /> : null}<div><strong>{item.file.name}</strong><small>{(item.file.size / 1024 / 1024).toFixed(2)} MB</small></div><button type="button" onClick={() => removeMedia(index)}>Remove</button></article>)}</div>}
              {mediaErrors.length > 0 && <div className="social-errors" role="alert">{mediaErrors.map((error) => <span key={error}>{error}</span>)}</div>}
              <div className="social-actions"><button className="social-secondary" type="button" onClick={clearPublishDraft}>Clear draft</button><button className="creator-primary" type="button" disabled={publishDisabled}>Publish to {platform.name}</button></div>
              <div className="connection-gate"><strong>{publishGateTitle}</strong><span>{publishGateMessage}</span></div>
            </div>
            <aside className="social-preview"><div><p className="eyebrow">Preview</p><h3>{format.label}</h3><span>{format.width} × {format.height}px · {format.aspectRatio}</span></div><div className="social-frame" style={{ aspectRatio: format.aspectRatio.replace(':', ' / ') }}>{media[0]?.url ? media[0].file.type.startsWith('video/') ? <video src={media[0].url} muted controls /> : <img src={media[0].url} alt="Selected social creative" /> : <div><strong>No media selected</strong><span>Your first compatible asset will appear here.</span></div>}</div>{caption && <p className="preview-caption">{caption}</p>}</aside>
          </div>
        </section>
      )}
    </section>
  );
}
