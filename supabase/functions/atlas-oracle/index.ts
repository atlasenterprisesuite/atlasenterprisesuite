import {
  buildOracleInterpretation,
  drawCards,
  spreadForReadingType,
  type OracleCard,
  type OracleReadingType
} from '../../../packages/oracle/src/index.ts';

const SUPABASE_URL = 'https://ggmanzcgtlrvqfoccgsh.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_wicVjdsduxa5FAnRW9k0Lw_HxtBW72d';
const PRIVATE_ENTITLEMENT = 'atlas.oracle.private';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info, x-atlas-org-id',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff'
};

type JsonRecord = Record<string, unknown>;

type Caller = {
  id: string;
  authorization: string;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json; charset=utf-8' }
  });
}

function errorResponse(code: string, status: number) {
  return json({ ok: false, error: code }, status);
}

async function parseJson(response: Response) {
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    const message = typeof data === 'object' && data && 'message' in data
      ? String((data as { message?: unknown }).message || `request_failed_${response.status}`)
      : `request_failed_${response.status}`;
    throw Object.assign(new Error(message), { status: response.status });
  }
  return data;
}

async function resolveCaller(req: Request): Promise<Caller> {
  const authorization = req.headers.get('authorization') || '';
  if (!authorization.toLowerCase().startsWith('bearer ')) {
    throw Object.assign(new Error('authentication_required'), { status: 401 });
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: PUBLISHABLE_KEY,
      authorization
    }
  });

  if (!response.ok) {
    throw Object.assign(new Error('authentication_required'), { status: 401 });
  }

  const user = await response.json();
  if (!user?.id) throw Object.assign(new Error('authentication_required'), { status: 401 });
  return { id: String(user.id), authorization };
}

async function restFetch(caller: Caller, path: string, init: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...init,
    headers: {
      apikey: PUBLISHABLE_KEY,
      authorization: caller.authorization,
      'content-type': 'application/json',
      ...(init.headers || {})
    }
  });
}

async function rpc<T>(caller: Caller, name: string, body: JsonRecord = {}): Promise<T> {
  const response = await restFetch(caller, `/rpc/${name}`, {
    method: 'POST',
    body: JSON.stringify(body)
  });
  return await parseJson(response) as T;
}

async function requireEntitlement(caller: Caller) {
  const entitled = await rpc<boolean>(caller, 'has_oracle_entitlement');
  if (!entitled) throw Object.assign(new Error('oracle_not_entitled'), { status: 403 });
}

async function loadDeck(caller: Caller) {
  const response = await restFetch(
    caller,
    '/oracle_decks?slug=eq.mensajes-oraculo-mistico&is_active=eq.true&select=id,slug,name,description,version,expected_card_count,verified_card_count,is_complete&limit=1'
  );
  const rows = await parseJson(response) as JsonRecord[];
  const deck = rows?.[0];
  if (!deck?.id) throw Object.assign(new Error('oracle_deck_unavailable'), { status: 503 });
  return deck;
}

async function loadCards(caller: Caller, deckId: string) {
  const response = await restFetch(
    caller,
    `/oracle_cards?deck_id=eq.${encodeURIComponent(deckId)}&is_active=eq.true&select=id,deck_id,slug,title,short_message,long_message,category,image_asset_key,position&order=position.asc`
  );
  return await parseJson(response) as JsonRecord[];
}

function normalizeCard(row: JsonRecord): OracleCard {
  return {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    shortMessage: String(row.short_message || ''),
    longMessage: String(row.long_message || ''),
    category: String(row.category) as OracleCard['category']
  };
}

function assertReadingType(value: unknown): OracleReadingType {
  const candidate = String(value || 'daily') as OracleReadingType;
  const allowed: OracleReadingType[] = ['daily', 'love', 'money', 'work', 'emotional', 'spiritual', 'full'];
  if (!allowed.includes(candidate)) throw Object.assign(new Error('invalid_reading_type'), { status: 400 });
  return candidate;
}

async function getStatus(caller: Caller) {
  const entitled = await rpc<boolean>(caller, 'has_oracle_entitlement');
  if (!entitled) return { ok: true, entitled: false, entitlement: PRIVATE_ENTITLEMENT, deck: null };
  const deck = await loadDeck(caller);
  return { ok: true, entitled: true, entitlement: PRIVATE_ENTITLEMENT, deck };
}

async function getDeck(caller: Caller) {
  await requireEntitlement(caller);
  const deck = await loadDeck(caller);
  const cards = await loadCards(caller, String(deck.id));
  return { ok: true, deck, cards };
}

async function listReadings(caller: Caller) {
  await requireEntitlement(caller);
  const response = await restFetch(
    caller,
    '/oracle_readings?select=id,reading_type,prompt_context,interpretation,created_at,deck_id&order=created_at.desc&limit=50'
  );
  const readings = await parseJson(response);
  return { ok: true, readings };
}

async function ownedReading(caller: Caller, readingId: string) {
  await requireEntitlement(caller);
  const readingResponse = await restFetch(
    caller,
    `/oracle_readings?id=eq.${encodeURIComponent(readingId)}&select=id,reading_type,prompt_context,interpretation,created_at,deck_id,organization_id&limit=1`
  );
  const readingRows = await parseJson(readingResponse) as JsonRecord[];
  const reading = readingRows?.[0];
  if (!reading?.id) throw Object.assign(new Error('oracle_reading_not_found'), { status: 404 });

  const [cardResponse, noteResponse, favoriteResponse] = await Promise.all([
    restFetch(
      caller,
      `/oracle_reading_cards?reading_id=eq.${encodeURIComponent(readingId)}&select=id,card_id,spread_position,sequence,oracle_cards(id,slug,title,short_message,long_message,category,image_asset_key,position)&order=sequence.asc`
    ),
    restFetch(caller, `/oracle_notes?reading_id=eq.${encodeURIComponent(readingId)}&select=id,note,updated_at&limit=1`),
    restFetch(caller, '/oracle_favorites?select=card_id')
  ]);

  const [cards, notes, favorites] = await Promise.all([
    parseJson(cardResponse),
    parseJson(noteResponse),
    parseJson(favoriteResponse)
  ]);

  return { ok: true, reading, cards, note: (notes as JsonRecord[])?.[0] || null, favorites };
}

async function createReading(caller: Caller, body: JsonRecord) {
  await requireEntitlement(caller);
  const readingType = assertReadingType(body.reading_type);
  const focus = String(body.focus || '').trim().slice(0, 2000) || null;
  const organizationId = body.organization_id ? String(body.organization_id) : null;
  const deck = await loadDeck(caller);
  const rawCards = await loadCards(caller, String(deck.id));
  const verifiedCards = rawCards.map(normalizeCard);
  const spread = spreadForReadingType(readingType);

  if (verifiedCards.length < spread.length) {
    throw Object.assign(new Error('oracle_deck_insufficient'), { status: 409 });
  }

  const readingId = crypto.randomUUID();
  const drawn = drawCards(verifiedCards, spread.length, readingId);
  const interpretation = buildOracleInterpretation(spread, drawn);

  const readingResponse = await restFetch(caller, '/oracle_readings?select=id,reading_type,prompt_context,interpretation,created_at,deck_id,organization_id', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      id: readingId,
      user_id: caller.id,
      organization_id: organizationId,
      deck_id: String(deck.id),
      reading_type: readingType,
      prompt_context: focus,
      interpretation
    })
  });
  const insertedReadings = await parseJson(readingResponse) as JsonRecord[];
  const reading = insertedReadings?.[0];
  if (!reading?.id) throw Object.assign(new Error('oracle_reading_persist_failed'), { status: 500 });

  const selected = spread.map((position, sequence) => ({
    reading_id: readingId,
    card_id: drawn[sequence].id,
    spread_position: position.key,
    sequence
  }));

  const cardsResponse = await restFetch(caller, '/oracle_reading_cards?select=id,reading_id,card_id,spread_position,sequence', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(selected)
  });
  const persistedCards = await parseJson(cardsResponse);

  return {
    ok: true,
    reading,
    cards: persistedCards,
    selected_cards: drawn,
    interpretation,
    disclaimer: 'This reading is symbolic reflection, not a guaranteed prediction or medical, financial, or legal advice.'
  };
}

async function saveNote(caller: Caller, body: JsonRecord) {
  await requireEntitlement(caller);
  const readingId = String(body.reading_id || '');
  if (!readingId) throw Object.assign(new Error('reading_id_required'), { status: 400 });
  await ownedReading(caller, readingId);
  const note = String(body.note || '').slice(0, 12000);
  const response = await restFetch(caller, '/oracle_notes?on_conflict=user_id,reading_id&select=id,reading_id,note,updated_at', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ user_id: caller.id, reading_id: readingId, note, updated_at: new Date().toISOString() })
  });
  const rows = await parseJson(response) as JsonRecord[];
  return { ok: true, note: rows?.[0] || null };
}

async function setFavorite(caller: Caller, body: JsonRecord) {
  await requireEntitlement(caller);
  const cardId = String(body.card_id || '');
  if (!cardId) throw Object.assign(new Error('card_id_required'), { status: 400 });
  const favorite = body.favorite !== false;

  if (favorite) {
    const response = await restFetch(caller, '/oracle_favorites?on_conflict=user_id,card_id&select=id,card_id,created_at', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({ user_id: caller.id, card_id: cardId })
    });
    const rows = await parseJson(response) as JsonRecord[];
    return { ok: true, favorite: true, record: rows?.[0] || null };
  }

  const response = await restFetch(
    caller,
    `/oracle_favorites?user_id=eq.${encodeURIComponent(caller.id)}&card_id=eq.${encodeURIComponent(cardId)}`,
    { method: 'DELETE', headers: { Prefer: 'return=minimal' } }
  );
  await parseJson(response);
  return { ok: true, favorite: false };
}

async function requestBody(req: Request): Promise<JsonRecord> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' ? body as JsonRecord : {};
  } catch {
    return {};
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  const url = new URL(req.url);
  const api = url.searchParams.get('api') || 'status';

  try {
    const caller = await resolveCaller(req);

    if (api === 'status') return json(await getStatus(caller));
    if (api === 'deck') return json(await getDeck(caller));
    if (api === 'readings') return json(await listReadings(caller));
    if (api === 'reading') {
      const id = url.searchParams.get('id') || '';
      if (!id) return errorResponse('reading_id_required', 400);
      return json(await ownedReading(caller, id));
    }
    if (api === 'create') {
      if (req.method !== 'POST') return errorResponse('method_not_allowed', 405);
      return json(await createReading(caller, await requestBody(req)), 201);
    }
    if (api === 'note') {
      if (req.method !== 'POST') return errorResponse('method_not_allowed', 405);
      return json(await saveNote(caller, await requestBody(req)));
    }
    if (api === 'favorite') {
      if (req.method !== 'POST') return errorResponse('method_not_allowed', 405);
      return json(await setFavorite(caller, await requestBody(req)));
    }
    return errorResponse('not_found', 404);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'internal_error';
    const status = typeof error === 'object' && error && 'status' in error
      ? Number((error as { status?: unknown }).status || 500)
      : 500;
    console.error('atlas_oracle_request_failed', { code, status });
    return errorResponse(code, status >= 400 && status < 600 ? status : 500);
  }
});
