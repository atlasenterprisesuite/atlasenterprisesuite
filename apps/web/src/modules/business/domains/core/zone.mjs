/**
 * ATLAS first-party DNS zone validation core.
 * Pure functions only: no DNS writes, registration, payments or network calls.
 * Intended for reuse behind authenticated, tenant-scoped server APIs.
 */
export const RECORD_TYPES = Object.freeze(["A","AAAA","CNAME","MX","TXT","NS","CAA"]);
const NAME = /^(?:\*|[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))*$/;
const IPV4 = /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const IPV6 = /^[0-9a-f:]+$/i;
export function normalizeZoneName(name) {
  if (typeof name !== "string") throw new TypeError("Zone name must be a string");
  const value = name.trim().toLowerCase().replace(/\.$/, "");
  if (!value || value.length > 253 || !NAME.test(value) || !value.includes(".") || value.includes("*"))
    throw new Error("Invalid DNS zone name");
  return value;
}
export function validateZoneRecord(zoneName, record) {
  const zone = normalizeZoneName(zoneName);
  if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error("Invalid DNS record");
  const type = String(record.type || "").toUpperCase();
  if (!RECORD_TYPES.includes(type)) throw new Error("Unsupported DNS record type");
  const name = String(record.name || "@").trim().toLowerCase().replace(/\.$/, "");
  if (name !== "@" && (!NAME.test(name) || name.length > 253 || (name !== zone && !name.endsWith("." + zone) && name.includes("."))))
    throw new Error("Record name must belong to the zone");
  const ttl = record.ttl ?? 3600;
  if (!Number.isInteger(ttl) || ttl < 60 || ttl > 86400) throw new Error("TTL out of range");
  const value = String(record.value ?? "").trim();
  if (!value || value.length > 4096 || /[\r\n]/.test(value)) throw new Error("Invalid record value");
  if (type === "A" && !IPV4.test(value)) throw new Error("Invalid IPv4 address");
  if (type === "AAAA" && (!IPV6.test(value) || !value.includes(":"))) throw new Error("Invalid IPv6 address");
  if (type === "MX" && (!Number.isInteger(record.priority) || record.priority < 0 || record.priority > 65535))
    throw new Error("MX priority required");
  return Object.freeze({ zone, name, type, value, ttl, ...(type === "MX" ? {priority: record.priority} : {}) });
}
export function validateZoneChange(zoneName, records) {
  if (!Array.isArray(records) || records.length > 500) throw new Error("Invalid zone change batch");
  const normalized = records.map(record => validateZoneRecord(zoneName, record));
  const cnames = new Set(normalized.filter(r => r.type === "CNAME").map(r => r.name));
  if (normalized.some(r => r.type !== "CNAME" && cnames.has(r.name)))
    throw new Error("CNAME conflicts with another record at the same name");
  return Object.freeze(normalized);
}
