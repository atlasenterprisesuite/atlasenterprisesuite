import { beforeEach, describe, expect, it, vi } from 'vitest';

const authorizedAtlasFetch = vi.fn();
const getActiveAtlasOrganization = vi.fn();

vi.mock('../../apps/web/src/lib/atlasSession', () => ({
  authorizedAtlasFetch,
  getActiveAtlasOrganization
}));

import {
  createOracleReading,
  getOracleReading,
  getOracleStatus,
  listOracleReadings,
  saveOracleNote,
  setOracleFavorite
} from '../../apps/web/src/lib/oracleApi';

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

describe('oracleApi', () => {
  beforeEach(() => {
    authorizedAtlasFetch.mockReset();
    getActiveAtlasOrganization.mockReset();
    getActiveAtlasOrganization.mockResolvedValue({ id: 'org-1', role: 'owner' });
  });

  it('loads the private entitlement status through authorizedAtlasFetch', async () => {
    authorizedAtlasFetch.mockResolvedValue(response({ ok: true, entitled: true, deck: { verified_card_count: 7 } }));
    const result = await getOracleStatus();
    expect(result.entitled).toBe(true);
    expect(authorizedAtlasFetch).toHaveBeenCalledWith('/functions/v1/atlas-oracle?api=status', { method: 'GET' });
  });

  it('creates a reading with the active organization context', async () => {
    authorizedAtlasFetch.mockResolvedValue(response({ ok: true, reading: { id: 'reading-1' } }, 201));
    const result = await createOracleReading({ reading_type: 'daily', focus: 'today' });
    expect(result.reading.id).toBe('reading-1');
    expect(authorizedAtlasFetch).toHaveBeenCalledWith('/functions/v1/atlas-oracle?api=create', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ reading_type: 'daily', focus: 'today', organization_id: 'org-1' })
    }));
  });

  it('uses owned endpoints for history, detail, notes and favorites', async () => {
    authorizedAtlasFetch.mockResolvedValue(response({ ok: true, readings: [] }));
    await listOracleReadings();
    expect(authorizedAtlasFetch).toHaveBeenLastCalledWith('/functions/v1/atlas-oracle?api=readings', { method: 'GET' });

    authorizedAtlasFetch.mockResolvedValue(response({ ok: true, reading: { id: 'r1' } }));
    await getOracleReading('r1');
    expect(authorizedAtlasFetch).toHaveBeenLastCalledWith('/functions/v1/atlas-oracle?api=reading&id=r1', { method: 'GET' });

    authorizedAtlasFetch.mockResolvedValue(response({ ok: true }));
    await saveOracleNote('r1', 'private note');
    await setOracleFavorite('c1', true);
    expect(authorizedAtlasFetch).toHaveBeenCalledWith('/functions/v1/atlas-oracle?api=note', expect.objectContaining({ method: 'POST' }));
    expect(authorizedAtlasFetch).toHaveBeenCalledWith('/functions/v1/atlas-oracle?api=favorite', expect.objectContaining({ method: 'POST' }));
  });

  it('preserves the service error code for entitlement denial', async () => {
    authorizedAtlasFetch.mockResolvedValue(response({ ok: false, error: 'oracle_not_entitled' }, 403));
    await expect(getOracleStatus()).rejects.toMatchObject({ status: 403, code: 'oracle_not_entitled' });
  });
});
