import { authorizedAtlasFetch, getActiveAtlasOrganization } from './atlasSession';

export type OracleReadingType = 'daily' | 'love' | 'money' | 'work' | 'emotional' | 'spiritual' | 'full';

export type OracleDeckStatus = {
  id?: string;
  slug?: string;
  name?: string;
  description?: string;
  expected_card_count?: number;
  verified_card_count?: number;
  is_complete?: boolean;
};

export type OracleStatus = {
  ok: boolean;
  entitled: boolean;
  entitlement?: string;
  deck: OracleDeckStatus | null;
};

export type OracleCardRecord = {
  id: string;
  slug: string;
  title: string;
  short_message: string;
  long_message: string;
  category: string;
  image_asset_key?: string | null;
  position?: number;
};

export type OracleReadingSummary = {
  id: string;
  reading_type: OracleReadingType;
  prompt_context?: string | null;
  interpretation?: unknown;
  created_at: string;
  deck_id?: string;
};

export type OracleReadingDetail = {
  ok: boolean;
  reading: OracleReadingSummary & { organization_id?: string | null };
  cards?: Array<{
    id?: string;
    card_id: string;
    spread_position: string;
    sequence: number;
    oracle_cards?: OracleCardRecord | OracleCardRecord[];
  }>;
  selected_cards?: Array<{
    id: string;
    slug: string;
    title: string;
    shortMessage: string;
    longMessage: string;
    category: string;
  }>;
  interpretation?: Array<{
    position: { key: string; label: string };
    card: { id: string; title: string; longMessage?: string };
    reflection: string;
  }>;
  note?: { id: string; note: string; updated_at?: string } | null;
  favorites?: Array<{ card_id: string }>;
  disclaimer?: string;
};

export class OracleApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(code: string, status: number) {
    super(code);
    this.name = 'OracleApiError';
    this.status = status;
    this.code = code;
  }
}

async function parseOracleResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let body: any = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { error: text || `oracle_request_failed_${response.status}` };
  }
  if (!response.ok) {
    const code = String(body?.error || body?.message || `oracle_request_failed_${response.status}`);
    throw new OracleApiError(code, response.status);
  }
  return body as T;
}

export async function getOracleStatus(): Promise<OracleStatus> {
  const response = await authorizedAtlasFetch('/functions/v1/atlas-oracle?api=status', { method: 'GET' });
  return parseOracleResponse<OracleStatus>(response);
}

export async function getOracleDeck(): Promise<{ ok: true; deck: OracleDeckStatus; cards: OracleCardRecord[] }> {
  const response = await authorizedAtlasFetch('/functions/v1/atlas-oracle?api=deck', { method: 'GET' });
  return parseOracleResponse(response);
}

export async function listOracleReadings(): Promise<{ ok: true; readings: OracleReadingSummary[] }> {
  const response = await authorizedAtlasFetch('/functions/v1/atlas-oracle?api=readings', { method: 'GET' });
  return parseOracleResponse(response);
}

export async function getOracleReading(id: string): Promise<OracleReadingDetail> {
  const response = await authorizedAtlasFetch(`/functions/v1/atlas-oracle?api=reading&id=${encodeURIComponent(id)}`, { method: 'GET' });
  return parseOracleResponse(response);
}

export async function createOracleReading(input: { reading_type: OracleReadingType; focus?: string }): Promise<OracleReadingDetail> {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch('/functions/v1/atlas-oracle?api=create', {
    method: 'POST',
    body: JSON.stringify({
      reading_type: input.reading_type,
      focus: input.focus || undefined,
      organization_id: organization.id
    })
  });
  return parseOracleResponse(response);
}

export async function saveOracleNote(readingId: string, note: string) {
  const response = await authorizedAtlasFetch('/functions/v1/atlas-oracle?api=note', {
    method: 'POST',
    body: JSON.stringify({ reading_id: readingId, note })
  });
  return parseOracleResponse<{ ok: true; note: { id: string; note: string } | null }>(response);
}

export async function setOracleFavorite(cardId: string, favorite: boolean) {
  const response = await authorizedAtlasFetch('/functions/v1/atlas-oracle?api=favorite', {
    method: 'POST',
    body: JSON.stringify({ card_id: cardId, favorite })
  });
  return parseOracleResponse<{ ok: true; favorite: boolean }>(response);
}
