import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { analyzeWeeklySocialMetrics, parseSocialMetrics, type WeeklySocialAnalysis } from '../../../../../../packages/social/src/analytics';
import { buildConversationQuestions, buildFollowerWelcomeMessages, type FollowerWelcomeMessages } from '../../../../../../packages/social/src/drafting';
import { buildSocialCrmHandoff, filterSocialInbox, type SocialInboxStatus, type SocialInboxThread } from '../../../../../../packages/social/src/inbox';
import { initialScheduleStatus, validateSocialScheduleInput, type SocialScheduledPost } from '../../../../../../packages/social/src/scheduling';
import { getPlatform, socialPlatforms, type PlatformId } from '../../../../../../packages/social/src/platforms';
import {
  cancelSocialSchedule,
  createImportedSocialThread,
  createSocialSchedule,
  listSocialInboxThreads,
  listSocialSchedules,
  updateSocialThreadStatus
} from './socialApi';
import './social-command-center.css';

type SocialTab = 'analyze' | 'inbox' | 'engage' | 'schedule';
const emptyWelcomes: FollowerWelcomeMessages = { casual: '', valueFirst: '', questionLed: '' };

function defaultScheduleTime() {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  const offset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function SocialCommandCenterPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<SocialTab>('inbox');

  const [metricsInput, setMetricsInput] = useState('');
  const [analysis, setAnalysis] = useState<WeeklySocialAnalysis | null>(null);
  const [metricErrors, setMetricErrors] = useState<string[]>([]);

  const [topic, setTopic] = useState('');
  const [niche, setNiche] = useState('');
  const [audience, setAudience] = useState('');
  const [tone, setTone] = useState('professional');
  const [questions, setQuestions] = useState<string[]>([]);
  const [welcomes, setWelcomes] = useState<FollowerWelcomeMessages>(emptyWelcomes);

  const [threads, setThreads] = useState<SocialInboxThread[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxError, setInboxError] = useState('');
  const [inboxPlatform, setInboxPlatform] = useState<PlatformId | 'all'>('all');
  const [inboxStatus, setInboxStatus] = useState<SocialInboxStatus | 'all'>('all');
  const [inboxQuery, setInboxQuery] = useState('');
  const [importPlatform, setImportPlatform] = useState<PlatformId>('instagram');
  const [importName, setImportName] = useState('');
  const [importHandle, setImportHandle] = useState('');
  const [importPreview, setImportPreview] = useState('');

  const [schedules, setSchedules] = useState<SocialScheduledPost[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState('');
  const [schedulePlatform, setSchedulePlatform] = useState<PlatformId>('instagram');
  const [scheduleCaption, setScheduleCaption] = useState('');
  const [scheduleFor, setScheduleFor] = useState(defaultScheduleTime);

  const visibleThreads = useMemo(
    () => filterSocialInbox(threads, { platform: inboxPlatform, status: inboxStatus, query: inboxQuery }),
    [threads, inboxPlatform, inboxStatus, inboxQuery]
  );

  async function refreshInbox() {
    setInboxLoading(true);
    setInboxError('');
    try { setThreads(await listSocialInboxThreads()); }
    catch (error) { setInboxError(error instanceof Error ? error.message : 'Social inbox unavailable'); }
    finally { setInboxLoading(false); }
  }

  async function refreshSchedules() {
    setScheduleLoading(true);
    setScheduleError('');
    try { setSchedules(await listSocialSchedules()); }
    catch (error) { setScheduleError(error instanceof Error ? error.message : 'Social schedule unavailable'); }
    finally { setScheduleLoading(false); }
  }

  useEffect(() => { void refreshInbox(); void refreshSchedules(); }, []);

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

  async function importThread(event: FormEvent) {
    event.preventDefault();
    if (!importName.trim() || !importPreview.trim()) return;
    setInboxError('');
    try {
      const created = await createImportedSocialThread({
        platform: importPlatform,
        contactName: importName,
        handle: importHandle,
        preview: importPreview
      });
      setThreads((current) => [created, ...current]);
      setImportName('');
      setImportHandle('');
      setImportPreview('');
    } catch (error) {
      setInboxError(error instanceof Error ? error.message : 'Social inbox import failed');
    }
  }

  async function changeThreadStatus(thread: SocialInboxThread, status: SocialInboxStatus) {
    setInboxError('');
    try {
      const updated = await updateSocialThreadStatus(thread.id, status);
      setThreads((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (error) {
      setInboxError(error instanceof Error ? error.message : 'Social inbox update failed');
    }
  }

  function sendToCrm(thread: SocialInboxThread, objectType: 'contact' | 'deal' | 'ticket') {
    navigate('/crm/social-handoff', {
      state: { socialHandoff: buildSocialCrmHandoff(thread, objectType) }
    });
  }

  async function schedulePost(event: FormEvent) {
    event.preventDefault();
    const scheduledFor = new Date(scheduleFor).toISOString();
    const errors = validateSocialScheduleInput({
      platform: schedulePlatform,
      caption: scheduleCaption,
      scheduledFor
    });
    if (errors.length) {
      setScheduleError(errors.join(' '));
      return;
    }
    const connection = getPlatform(schedulePlatform).connectionStatus;
    setScheduleError('');
    try {
      const created = await createSocialSchedule({
        platform: schedulePlatform,
        caption: scheduleCaption,
        scheduledFor,
        status: initialScheduleStatus(connection),
        providerConnectionState: connection
      });
      setSchedules((current) => [...current, created].sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor)));
      setScheduleCaption('');
      setScheduleFor(defaultScheduleTime());
    } catch (error) {
      setScheduleError(error instanceof Error ? error.message : 'Social schedule save failed');
    }
  }

  async function cancel(post: SocialScheduledPost) {
    try {
      const updated = await cancelSocialSchedule(post.id);
      setSchedules((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (error) {
      setScheduleError(error instanceof Error ? error.message : 'Social schedule cancellation failed');
    }
  }

  const engagementReady = Boolean(topic.trim() && niche.trim() && audience.trim());

  return (
    <section className="creator-page social-command-center">
      <nav className="creator-breadcrumb" aria-label="Breadcrumb">
        <Link to="/studio">ATLAS Studio</Link><span>/</span><span>Social Command Center</span>
      </nav>

      <header className="creator-hero compact">
        <div>
          <p className="eyebrow">Creator Studio · Social Intelligence</p>
          <h1>Social Command Center</h1>
          <p>One governed workspace for imported/provider conversations, scheduling, engagement intelligence and CRM handoff. External publishing remains fail-closed until a provider is authorized.</p>
        </div>
        <Link className="creator-primary social-publisher-link" to="/business/growth/social-publisher">Open Social Publisher</Link>
      </header>

      <div className="social-command-tabs" role="tablist" aria-label="Social Command Center sections">
        {(['inbox', 'schedule', 'analyze', 'engage'] as SocialTab[]).map((item) => (
          <button key={item} type="button" role="tab" aria-selected={tab === item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>
            {item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'inbox' && (
        <section className="social-command-panel">
          <div className="social-panel-heading">
            <div><p className="eyebrow">Universal inbox</p><h2>Conversations with source truth</h2></div>
            <button type="button" className="secondary-button" onClick={() => void refreshInbox()} disabled={inboxLoading}>Refresh</button>
          </div>
          <p className="social-helper">Provider messages appear only after an authorized connector exists. Until then, explicit imports can be triaged without pretending that a social account is connected.</p>

          <form className="social-import-grid" onSubmit={importThread}>
            <label><span>Platform</span><select value={importPlatform} onChange={(event) => setImportPlatform(event.target.value as PlatformId)}>{socialPlatforms.map((platform) => <option key={platform.id} value={platform.id}>{platform.name}</option>)}</select></label>
            <label><span>Contact name</span><input value={importName} onChange={(event) => setImportName(event.target.value)} placeholder="Name" /></label>
            <label><span>Handle</span><input value={importHandle} onChange={(event) => setImportHandle(event.target.value)} placeholder="@handle" /></label>
            <label className="wide"><span>Message preview</span><textarea rows={3} value={importPreview} onChange={(event) => setImportPreview(event.target.value)} placeholder="Paste an explicit conversation excerpt" /></label>
            <button className="creator-primary" type="submit" disabled={!importName.trim() || !importPreview.trim()}>Import conversation</button>
          </form>

          <div className="social-inbox-filters">
            <input aria-label="Search inbox" type="search" value={inboxQuery} onChange={(event) => setInboxQuery(event.target.value)} placeholder="Search conversations" />
            <select aria-label="Filter platform" value={inboxPlatform} onChange={(event) => setInboxPlatform(event.target.value as PlatformId | 'all')}><option value="all">All platforms</option>{socialPlatforms.map((platform) => <option key={platform.id} value={platform.id}>{platform.name}</option>)}</select>
            <select aria-label="Filter status" value={inboxStatus} onChange={(event) => setInboxStatus(event.target.value as SocialInboxStatus | 'all')}><option value="all">All statuses</option><option value="open">Open</option><option value="waiting">Waiting</option><option value="resolved">Resolved</option></select>
          </div>

          {inboxError ? <div className="social-command-error" role="alert">{inboxError}</div> : null}
          {inboxLoading ? <div className="social-command-empty">Loading inbox…</div> : null}
          {!inboxLoading && visibleThreads.length === 0 ? <div className="social-command-empty"><strong>No conversations in this view</strong><span>Import an explicit thread or connect an authorized provider when available.</span></div> : null}

          <div className="social-thread-list">
            {visibleThreads.map((thread) => (
              <article key={thread.id} className="social-thread-card">
                <div className="social-thread-head"><div><small>{getPlatform(thread.platform).name} · {thread.source}</small><h3>{thread.contactName}</h3><span>{thread.handle || 'No handle supplied'}</span></div><span className="status-chip neutral">{thread.status}</span></div>
                <p>{thread.preview}</p>
                <small>{new Date(thread.lastMessageAt).toLocaleString()} · {thread.unreadCount} unread</small>
                <div className="social-thread-actions">
                  <select aria-label={`Status for ${thread.contactName}`} value={thread.status} onChange={(event) => void changeThreadStatus(thread, event.target.value as SocialInboxStatus)}><option value="open">Open</option><option value="waiting">Waiting</option><option value="resolved">Resolved</option></select>
                  <button type="button" onClick={() => sendToCrm(thread, 'contact')}>CRM contact</button>
                  <button type="button" onClick={() => sendToCrm(thread, 'deal')}>CRM deal</button>
                  <button type="button" onClick={() => sendToCrm(thread, 'ticket')}>CRM ticket</button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === 'schedule' && (
        <section className="social-command-panel">
          <div className="social-panel-heading"><div><p className="eyebrow">Scheduler</p><h2>Persisted publication queue</h2></div><button type="button" className="secondary-button" onClick={() => void refreshSchedules()} disabled={scheduleLoading}>Refresh</button></div>
          <p className="social-helper">ATLAS persists the schedule now. Dispatch stays blocked when the selected provider is not authorized; no fake publish success is generated.</p>
          <form className="social-schedule-form" onSubmit={schedulePost}>
            <label><span>Platform</span><select value={schedulePlatform} onChange={(event) => setSchedulePlatform(event.target.value as PlatformId)}>{socialPlatforms.map((platform) => <option key={platform.id} value={platform.id}>{platform.name}</option>)}</select></label>
            <label><span>Publish time</span><input type="datetime-local" value={scheduleFor} onChange={(event) => setScheduleFor(event.target.value)} /></label>
            <label className="wide"><span>Caption</span><textarea rows={4} value={scheduleCaption} onChange={(event) => setScheduleCaption(event.target.value)} placeholder="Scheduled social copy" /></label>
            <button className="creator-primary" type="submit" disabled={!scheduleCaption.trim()}>Save schedule</button>
          </form>
          {scheduleError ? <div className="social-command-error" role="alert">{scheduleError}</div> : null}
          {scheduleLoading ? <div className="social-command-empty">Loading schedule…</div> : null}
          <div className="social-schedule-list">
            {schedules.map((post) => (
              <article key={post.id}>
                <div><strong>{getPlatform(post.platform).name}</strong><span>{new Date(post.scheduledFor).toLocaleString()}</span></div>
                <p>{post.caption}</p>
                <div><span className={`status-chip ${post.status === 'blocked_connection' ? 'warning' : 'neutral'}`}>{post.status.replaceAll('_', ' ')}</span><span>{post.providerConnectionState.replaceAll('_', ' ')}</span></div>
                {!['cancelled', 'published'].includes(post.status) ? <button type="button" onClick={() => void cancel(post)}>Cancel</button> : null}
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === 'analyze' && (
        <section className="social-command-panel">
          <div className="social-panel-heading"><div><p className="eyebrow">Weekly performance</p><h2>Analyze explicit metrics</h2></div><span className="status-chip neutral">source-bound</span></div>
          <p className="social-helper">One post per line: platform,publishedAt,format,hook,reach,engagements,comments,shares. ATLAS derives findings only from rows you provide.</p>
          <textarea className="social-metrics-input" rows={8} value={metricsInput} onChange={(event) => setMetricsInput(event.target.value)} placeholder="instagram,2026-09-18T14:00:00Z,reel,Strong hook,1000,150,20,10" />
          <div className="social-command-actions"><button className="creator-primary" type="button" onClick={runAnalysis}>Analyze metrics</button><button type="button" onClick={() => { setMetricsInput(''); setMetricErrors([]); setAnalysis(null); }}>Clear</button></div>
          {metricErrors.length ? <div className="social-command-error" role="alert">{metricErrors.join(' ')}</div> : null}
          {analysis ? <div className="social-analysis-grid"><article><small>Best format</small><strong>{analysis.bestFormat}</strong></article><article><small>Worst format</small><strong>{analysis.worstFormat}</strong></article><article><small>Best hook</small><strong>{analysis.bestHook}</strong></article><article><small>Best window</small><strong>{analysis.bestPostingWindow}</strong></article><article className="wide"><small>Highest-potential change</small><strong>{analysis.highestPotentialChange}</strong><ul>{analysis.experiments.map((experiment) => <li key={experiment}>{experiment}</li>)}</ul></article></div> : <div className="social-command-empty">No analysis until explicit metrics are supplied.</div>}
        </section>
      )}

      {tab === 'engage' && (
        <section className="social-command-panel">
          <div className="social-panel-heading"><div><p className="eyebrow">Social Copilot</p><h2>Draft engagement without auto-sending</h2></div><span className="status-chip neutral">draft only</span></div>
          <div className="social-engage-grid">
            <label><span>Topic</span><input value={topic} onChange={(event) => setTopic(event.target.value)} /></label>
            <label><span>Niche</span><input value={niche} onChange={(event) => setNiche(event.target.value)} /></label>
            <label><span>Audience</span><input value={audience} onChange={(event) => setAudience(event.target.value)} /></label>
            <label><span>Tone</span><select value={tone} onChange={(event) => setTone(event.target.value)}><option value="professional">Professional</option><option value="casual">Casual</option><option value="warm">Warm</option><option value="direct">Direct</option></select></label>
          </div>
          <button className="creator-primary" type="button" disabled={!engagementReady} onClick={generateEngagementDrafts}>Generate drafts</button>
          {questions.length ? <div className="social-draft-results"><section><h3>Conversation questions</h3><ol>{questions.map((question) => <li key={question}>{question}</li>)}</ol></section><section><h3>Follower welcomes</h3><p>{welcomes.casual}</p><p>{welcomes.valueFirst}</p><p>{welcomes.questionLed}</p></section><small>Draft suggestions only. Nothing was sent to any social account.</small></div> : <div className="social-command-empty">Provide topic, niche and audience to generate drafts.</div>}
        </section>
      )}
    </section>
  );
}
