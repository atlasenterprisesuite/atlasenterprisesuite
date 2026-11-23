/**
 * ATLAS Music Universe: a deliberately non-persistent, text-only index of an
 * official user-supplied ChatGPT conversations.json export.
 *
 * Never stores or returns raw messages, attachments, credentials or lyrics.
 * Any approved storage flow must use Knowledge Atlas's authenticated draft API.
 */
export type MusicChatTopic =
  | 'songs' | 'artists' | 'lyrics' | 'symbolism' | 'composition'
  | 'sound-design' | 'playlists' | 'music-video' | 'learning';

export type MusicChatIndexEntry = {
  sourceId: string;
  title: string;
  createdAt: number | null;
  matchedMessages: number;
  topics: MusicChatTopic[];
};

export type MusicChatIndex = {
  totalConversations: number;
  musicConversations: MusicChatIndexEntry[];
  truncated: boolean;
};

type UnknownObject = Record<string, unknown>;
const MAX_CONVERSATIONS = 30_000;
const MAX_NODES_PER_CONVERSATION = 4_000;
const MAX_MESSAGE_LENGTH = 12_000;

const MUSIC_CONTEXT = /(?:m[uú]sica|music|canci[oó]n|song|letras? (?:de|de la) |lyrics|spotify|playlist|[aá]lbum|album|binaural|neuroac[uú]stic|solfeggio|midi|acordes?|chords?|composici[oó]n|audio dna|synthesizer|sintetizador|melodic electron|alan walker|marconi union|brian eno|the killers|hotel california|somebody told me|titanium|atlas falls|faded(?: instrumental)?|weightless|music for airports)/iu;

const TOPIC_RULES: ReadonlyArray<{ id: MusicChatTopic; pattern: RegExp }> = [
  { id: 'songs', pattern: /(?:canci[oó]n|song|single|hotel california|somebody told me|titanium|atlas falls|faded|weightless|music for airports)/iu },
  { id: 'artists', pattern: /(?:artista|artist|banda|band|cantante|singer|alan walker|the killers|marconi union|brian eno|alesso|zara larsson)/iu },
  { id: 'lyrics', pattern: /(?:letras? (?:de|de la) |lyrics|traduc(?:ir|ci[oó]n)(?:.{0,30})(?:canci[oó]n|music|letra))/iu },
  { id: 'symbolism', pattern: /(?:simbol|s[ií]mbol|symbol|mensaje ocult|hidden meaning|interpretaci[oó]n|meaning|narrativa musical)/iu },
  { id: 'composition', pattern: /(?:composici[oó]n|composition|motivo musical|midi|acordes?|chords?|bpm|melod[ií]a|melody|instrumental|producci[oó]n musical)/iu },
  { id: 'sound-design', pattern: /(?:frecuencia|frequency|binaural|neuroac[uú]stic|solfeggio|ondas cerebrales|mezcla|audio dna|ambient|sound design|sintetizador|synthesizer|sonido)/iu },
  { id: 'playlists', pattern: /(?:playlist|lista de reproducci[oó]n|spotify|dj|mix(?:es|ing)?|session|sesi[oó]n musical)/iu },
  { id: 'music-video', pattern: /(?:videoclip|v[ií]deo musical|videos musicales|music video|visual de la canci[oó]n)/iu },
  { id: 'learning', pattern: /(?:aprender ingl[eé]s|learn english|pronunciaci[oó]n|vocabulario musical|vocabulary)/iu }
];

function asObject(value: unknown): UnknownObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as UnknownObject : null;
}

function getMusicTopics(value: string): MusicChatTopic[] {
  return TOPIC_RULES.filter(item => item.pattern.test(value)).map(item => item.id);
}

function textFromNode(value: unknown): string | null {
  const node = asObject(value);
  const message = asObject(node?.message);
  const author = asObject(message?.author);
  // System/tool messages can contain credentials, invisible instructions and logs.
  if (author?.role !== 'user' && author?.role !== 'assistant') return null;
  const content = asObject(message?.content);
  if (!content) return null;
  const text = Array.isArray(content.parts)
    ? content.parts.filter((part): part is string => typeof part === 'string').join(' ')
    : typeof content.text === 'string' ? content.text : '';
  return text.slice(0, MAX_MESSAGE_LENGTH);
}

export function indexChatGptMusicHistory(input: unknown): MusicChatIndex {
  const root = asObject(input);
  const conversations: unknown = Array.isArray(input) ? input : root?.conversations;
  if (!Array.isArray(conversations)) throw new Error('unsupported_chatgpt_export');
  const seen = new Set<string>();
  const musicConversations: MusicChatIndexEntry[] = [];
  let truncated = conversations.length > MAX_CONVERSATIONS;

  for (const raw of conversations.slice(0, MAX_CONVERSATIONS)) {
    const conversation = asObject(raw);
    const sourceId = conversation?.id;
    if (typeof sourceId !== 'string' || !sourceId.trim() || sourceId.length > 200 || seen.has(sourceId)) continue;
    seen.add(sourceId);
    const title = typeof conversation.title === 'string'
      ? conversation.title.slice(0, 180) : 'Untitled chat';
    const mapping = asObject(conversation.mapping);
    const nodes = mapping ? Object.values(mapping) : [];
    if (nodes.length > MAX_NODES_PER_CONVERSATION) truncated = true;

    const topics = new Set<MusicChatTopic>();
    const titleIsMusic = MUSIC_CONTEXT.test(title);
    if (titleIsMusic) getMusicTopics(title).forEach(topic => topics.add(topic));

    let matchedMessages = 0;
    for (const node of nodes.slice(0, MAX_NODES_PER_CONVERSATION)) {
      const text = textFromNode(node);
      if (text === null) continue;
      if (!MUSIC_CONTEXT.test(text)) continue;
      matchedMessages += 1;
      getMusicTopics(text).forEach(topic => topics.add(topic));
    }
    if (!titleIsMusic && !matchedMessages) continue;
    if (!topics.size) topics.add('songs');

    const createdAt = typeof conversation.create_time === 'number'
      && Number.isFinite(conversation.create_time)
      ? conversation.create_time : null;
    musicConversations.push({
      sourceId, title, createdAt, matchedMessages, topics: [...topics]
    });
  }

  return {
    totalConversations: conversations.length,
    musicConversations,
    truncated
  };
}

export function buildRestrictedMusicDraft(entry: MusicChatIndexEntry) {
  if (!entry.sourceId || !entry.title || !entry.topics.length) throw new Error('invalid_music_chat_index_entry');
  const tags = [...new Set(['music', ...entry.topics])];
  return {
    kind: 'note' as const,
    title: `Music history index: ${entry.title}`.slice(0, 240),
    summary: `ChatGPT export metadata: ${entry.matchedMessages} matched messages; topics ${entry.topics.join(', ')}.`,
    content: `Music-related conversation index, not the full transcript. Tags: ${entry.topics.join(', ')}. No message bodies, lyrics or attachments were transferred. Personal-source content requires separate review before any organizational use.`,
    sourceType: 'chat_import' as const,
    sourceRef: `chatgpt:${entry.sourceId}`,
    moduleIds: ['studio', 'knowledge'],
    tags,
    sensitivity: 'restricted' as const
  };
}
