export type AtlasCapabilitySource = 'module_adapter' | 'provider_adapter' | 'runtime';
export type AtlasCapabilityReadiness = 'ready' | 'blocked' | 'unavailable' | 'unverified';

export type AtlasCapabilityRegistration = {
  capabilityId: string;
  source: AtlasCapabilitySource;
  owner: string;
  readiness: AtlasCapabilityReadiness;
  reason?: string | null;
  metadata?: Readonly<Record<string, unknown>>;
};

export type AtlasCapabilityReadinessResult = {
  capabilityId: string;
  readiness: AtlasCapabilityReadiness;
  candidates: AtlasCapabilityRegistration[];
  reason: string;
};

function normalized(entry: AtlasCapabilityRegistration): AtlasCapabilityRegistration {
  const capabilityId = String(entry.capabilityId ?? '').trim();
  const owner = String(entry.owner ?? '').trim();
  if (!capabilityId) throw new Error('capability_id_required');
  if (!owner) throw new Error('capability_owner_required');
  return {
    capabilityId,
    source: entry.source,
    owner,
    readiness: entry.readiness,
    reason: String(entry.reason ?? '').trim() || null,
    metadata: entry.metadata ? { ...entry.metadata } : undefined
  };
}

export function createAtlasCapabilityCatalog(entries: readonly AtlasCapabilityRegistration[]) {
  const records = entries.map(normalized);
  const seen = new Set<string>();

  for (const entry of records) {
    const key = `${entry.source}:${entry.owner}:${entry.capabilityId}`;
    if (seen.has(key)) throw new Error(`duplicate_capability_registration:${key}`);
    seen.add(key);
  }

  const list = (capabilityId?: string) => {
    const wanted = String(capabilityId ?? '').trim();
    return records
      .filter((entry) => !wanted || entry.capabilityId === wanted)
      .map((entry) => ({ ...entry, metadata: entry.metadata ? { ...entry.metadata } : undefined }));
  };

  const readiness = (capabilityId: string): AtlasCapabilityReadinessResult => {
    const id = String(capabilityId ?? '').trim();
    if (!id) throw new Error('capability_id_required');
    const candidates = list(id);
    if (!candidates.length) {
      return { capabilityId: id, readiness: 'unavailable', candidates: [], reason: 'capability_not_registered' };
    }

    const order: AtlasCapabilityReadiness[] = ['ready', 'blocked', 'unverified', 'unavailable'];
    const state = order.find((candidate) => candidates.some((entry) => entry.readiness === candidate))
      ?? 'unavailable';
    const matching = candidates.filter((entry) => entry.readiness === state);
    return {
      capabilityId: id,
      readiness: state,
      candidates,
      reason: matching[0]?.reason || `capability_${state}`
    };
  };

  const requireReady = (capabilityId: string) => {
    const result = readiness(capabilityId);
    if (result.readiness !== 'ready') {
      throw new Error(`capability_not_ready:${result.readiness}`);
    }
    return result;
  };

  return Object.freeze({ list, readiness, requireReady });
}
