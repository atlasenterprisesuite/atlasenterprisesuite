import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { createAtlasMemoryDraft } from '../../knowledge/memoryApi';
import {
  buildRestrictedMusicDraft,
  indexChatGptMusicHistory,
  type MusicChatIndex
} from '../../../../../../packages/creator/audio/chat_history';
import './music-chat-history.css';

const MAX_EXPORT_BYTES = 30 * 1024 * 1024;
const MAX_BATCH = 20;
const MAX_VISIBLE = 100;

export function MusicChatHistoryPanel() {
  const [index, setIndex] = useState<MusicChatIndex | null>(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('No chat export has been selected.');
  const [working, setWorking] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(() => new Set());
  const mounted = useRef(true);
  const readingToken = useRef(0);
  const saving = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      readingToken.current += 1;
    };
  }, []);

  function clear() {
    readingToken.current += 1;
    setIndex(null);
    setQuery('');
    setSavedIds(new Set());
    setError('');
    setMessage('No chat export has been selected.');
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    clear();
    if (!file) return;
    if (!/\.json$/i.test(file.name)) {
      setError('Choose the extracted conversations JSON file, not a ZIP archive. No data was uploaded.');
      return;
    }
    if (!file.size || file.size > MAX_EXPORT_BYTES) {
      setError('This JSON file is empty or exceeds the 30 MB local preview limit. No data was uploaded.');
      return;
    }
    const token = ++readingToken.current;
    setWorking(true);
    try {
      const json = JSON.parse(await file.text()) as unknown;
      const result = indexChatGptMusicHistory(json);
      if (!mounted.current || token !== readingToken.current) return;
      setIndex(result);
      setMessage(`${result.musicConversations.length} music-related conversation(s) indexed locally out of ${result.totalConversations}. No message text uploaded.`);
    } catch (caught) {
      if (!mounted.current || token !== readingToken.current) return;
      setError(caught instanceof SyntaxError ? 'Unable to parse JSON. Use the ChatGPT conversations export file.' :
        caught instanceof Error ? caught.message : 'Local preview failed.');
    } finally {
      if (mounted.current && token === readingToken.current) setWorking(false);
    }
  }

  async function saveOne(sourceId: string) {
    if (saving.current || !index) return;
    const entry = index.musicConversations.find(item => item.sourceId === sourceId);
    if (!entry || savedIds.has(sourceId)) return;
    saving.current = true;
    setSavingId(sourceId);
    setError('');
    try {
      await createAtlasMemoryDraft(buildRestrictedMusicDraft(entry));
      if (!mounted.current) return;
      setSavedIds(prev => new Set([...prev, sourceId]));
      setMessage('One restricted metadata-only draft created in Knowledge Atlas. It is not approved knowledge.');
    } catch (caught) {
      if (mounted.current) setError(caught instanceof Error ? caught.message : 'Draft not saved. Owner/admin permissions may be required.');
    } finally {
      saving.current = false;
      if (mounted.current) setSavingId(null);
    }
  }

  async function saveBatch() {
    if (saving.current || !index) return;
    const remaining = index.musicConversations.filter(item => !savedIds.has(item.sourceId)).slice(0, MAX_BATCH);
    if (!remaining.length) return;
    saving.current = true;
    setSavingId('batch');
    setError('');
    let completed = 0;
    try {
      for (const entry of remaining) {
        if (!mounted.current) break;
        await createAtlasMemoryDraft(buildRestrictedMusicDraft(entry));
        completed++;
        if (!mounted.current) break;
        setSavedIds(prev => new Set([...prev, entry.sourceId]));
        setMessage(`${completed} restricted drafts saved in this batch; no chat bodies transferred.`);
      }
      if (mounted.current) setMessage(`${completed} restricted drafts created in Knowledge Atlas. Approval remains separate.`);
    } catch (caught) {
      if (mounted.current) setError(`Batch stopped after ${completed} saved record(s): ${caught instanceof Error ? caught.message : 'unknown error'}`);
    } finally {
      saving.current = false;
      if (mounted.current) setSavingId(null);
    }
  }

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = index?.musicConversations.filter(item => !normalizedQuery
    || item.title.toLowerCase().includes(normalizedQuery)
    || item.topics.some(topic => topic.includes(normalizedQuery))) ?? [];
  const remainingCount = index?.musicConversations.filter(item => !savedIds.has(item.sourceId)).length ?? 0;

  return <section className="atlas-chat-history atlas-dj-panel" aria-labelledby="atlas-chat-history-title">
    <header>
      <p className="eyebrow">ATLAS Music Universe 777 · History &amp; Knowledge</p>
      <h2 id="atlas-chat-history-title">Music chat history</h2>
      <p>Choose a ChatGPT <code>conversations.json</code> export to find music discussions locally. Only conversation titles, IDs, counts and topic labels are retained in this preview. Original chat text, media and lyrics are never uploaded by the preview.</p>
    </header>
    <div className="atlas-chat-history-tools">
      <label htmlFor="atlas-music-chat-file">Choose ChatGPT conversations JSON</label>
      <input id="atlas-music-chat-file" type="file" accept=".json,application/json" disabled={working || Boolean(savingId)} onChange={event => void chooseFile(event)} />
      <button type="button" onClick={clear} disabled={working || Boolean(savingId) || !index}>Clear local preview</button>
    </div>
    {error && <p role="alert" className="atlas-chat-history-error">{error}</p>}
    <p role="status" aria-live="polite" className="atlas-chat-history-status">{working ? 'Reading locally…' : message}</p>
    {index && <>
      <p className="atlas-chat-history-count">
        <strong>{index.musicConversations.length} music-related conversation{index.musicConversations.length === 1 ? '' : 's'}</strong>
        {' '}of {index.totalConversations} in the selected JSON. {savedIds.size} restricted drafts created this session.
      </p>
      {index.truncated && <p role="alert" className="atlas-chat-history-error">Preview limit reached: some conversations or messages were not inspected. This is not a complete index.</p>}
      <label className="atlas-chat-history-search">Filter local music index
        <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Song, artist, composition, symbolism…" />
      </label>
      <div className="atlas-chat-history-batch">
        <button type="button" onClick={() => void saveBatch()} disabled={Boolean(savingId) || remainingCount === 0}>
          Save next {Math.min(remainingCount, MAX_BATCH)} as restricted drafts
        </button>
        <span>Explicit action only. The existing authenticated Knowledge Atlas service enforces permissions and audit logs. Drafts are never automatically approved.</span>
      </div>
      <ul className="atlas-chat-history-list">
        {filtered.slice(0, MAX_VISIBLE).map(item => <li key={item.sourceId}>
          <div>
            <strong>{item.title}</strong>
            <span>{item.matchedMessages} matched messages · {item.topics.join(', ')}</span>
          </div>
          <button type="button" onClick={() => void saveOne(item.sourceId)} disabled={Boolean(savingId) || savedIds.has(item.sourceId)}
            aria-label={`Save restricted draft: ${item.title}`}>
            {savedIds.has(item.sourceId) ? 'Draft saved' : savingId === item.sourceId ? 'Saving…' : 'Save restricted draft'}
          </button>
        </li>)}
      </ul>
      {filtered.length > MAX_VISIBLE && <p className="atlas-dj-disclaimer">Showing first {MAX_VISIBLE} of {filtered.length} matches. Filter to narrow the preview; all indexed matches remain available for authorized batches.</p>}
    </>}
    <p className="atlas-dj-disclaimer">For the complete historical archive, use the authorized export/import process separately. This module does not access your ChatGPT account automatically, does not copy entire chats, and does not make private source records public. Restricted Knowledge Atlas drafts require owner/admin permissions.</p>
  </section>;
}
