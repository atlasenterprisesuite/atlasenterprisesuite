/**
 * First-party DNS zone control-plane domain service.
 * Storage is injected, not an external vendor SDK. Authorization is mandatory.
 * Adapter must provide get(tenantId, zone), put(tenantId, zone, entry, expectedVersion).
 * A durable adapter must enforce atomic compare-and-swap and tenant isolation.
 */
import { normalizeZoneName, validateZoneChange } from "./zone.mjs";

function requirePrincipal(principal, tenantId) {
  if (!principal || typeof principal !== "object" || !tenantId || principal.tenantId !== tenantId ||
      !Array.isArray(principal.roles) || !principal.roles.some(r => r === "owner" || r === "dns_admin"))
    throw new Error("DNS access denied");
}
function requireStorage(storage) {
  if (!storage || typeof storage.get !== "function" || typeof storage.put !== "function")
    throw new Error("DNS storage adapter required");
}
function requireVersion(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("Invalid expected version");
}
export async function readZone({ principal, tenantId, zoneName, storage }) {
  requirePrincipal(principal, tenantId);
  requireStorage(storage);
  const zone = normalizeZoneName(zoneName);
  return (await storage.get(tenantId, zone)) ?? null;
}
export async function writeZone({ principal, tenantId, zoneName, records, expectedVersion, storage, audit }) {
  requirePrincipal(principal, tenantId);
  requireStorage(storage);
  if (typeof audit !== "function") throw new Error("Durable audit writer required");
  requireVersion(expectedVersion);
  const zone = normalizeZoneName(zoneName);
  const normalized = validateZoneChange(zone, records);
  const previous = await storage.get(tenantId, zone);
  const currentVersion = previous?.version ?? 0;
  if (currentVersion !== expectedVersion) throw new Error("DNS zone version conflict");
  // Write an intent before mutation; a failed audit must prevent the change.
  await audit({action:"dns.zone.write.intent",tenantId,zone,actorId:principal.id,expectedVersion});
  const next = Object.freeze({zone,tenantId,version:expectedVersion + 1,records:normalized});
  await storage.put(tenantId, zone, next, expectedVersion);
  await audit({action:"dns.zone.write.committed",tenantId,zone,actorId:principal.id,version:next.version});
  return next;
}
/** Development/test-only adapter: not persistent, not safe for multi-process production. */
export function createMemoryZoneStorage() {
  const data = new Map();
  const key = (tenantId,zone) => JSON.stringify([tenantId,zone]);
  return {
    async get(tenantId,zone) { return data.get(key(tenantId,zone)) ?? null; },
    async put(tenantId,zone,entry,expectedVersion) {
      const k = key(tenantId,zone);
      if ((data.get(k)?.version ?? 0) !== expectedVersion) throw new Error("DNS zone version conflict");
      data.set(k,entry);
    }
  };
}
