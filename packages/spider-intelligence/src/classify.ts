export type SpiderSignal = Readonly<{ tenantId: string; id: string; kind: string; severity: "info" | "warning" | "critical"; evidenceSha: string; observedAt: string; idempotencyKey?: string }>;
export type SpiderContext = Readonly<{ tenantId: string; roles: readonly string[]; allowedKinds: readonly string[]; membershipActive?: boolean; revoked?: boolean; previouslyObservedKeys?: readonly string[] }>;
export type SpiderDecision = Readonly<{ status: "quarantined" | "observed"; reason: string; signalId: string; evidenceSha: string }>;
const safeId = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,127}$/.test(value);
const safeKind = (value: unknown): value is string => typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9:._-]{0,127}$/.test(value);
const validTimestamp = (value: unknown): boolean => {
  if (typeof value !== "string" || !/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,3})?Z$/.test(value)) return false;
  const millis = Date.parse(value);
  if (!Number.isFinite(millis)) return false;
  const canonical = new Date(millis).toISOString();
  return value.slice(0, 19) === canonical.slice(0, 19);
};
/** Pure, fail-closed observation only. Never authorizes or dispatches work. */
export function classifySpiderSignal(signal: SpiderSignal, context: SpiderContext): SpiderDecision {
  const deny = (reason: string): SpiderDecision => ({ status: "quarantined", reason, signalId: typeof signal?.id === "string" ? signal.id : "", evidenceSha: typeof signal?.evidenceSha === "string" ? signal.evidenceSha : "" });
  if (!signal || !context || !safeId(signal.id) || !safeId(signal.tenantId) || !safeKind(signal.kind) || !validTimestamp(signal.observedAt)) return deny("invalid-evidence");
  if (typeof signal.evidenceSha !== "string" || !/^[a-f0-9]{40}$/.test(signal.evidenceSha)) return deny("invalid-sha");
  if (!safeId(context.tenantId) || signal.tenantId !== context.tenantId) return deny("cross-tenant");
  if (context.membershipActive !== true || context.revoked !== false || !Array.isArray(context.roles) || !context.roles.includes("spider:observe")) return deny("membership-or-role-denied");
  if (!Array.isArray(context.allowedKinds) || !context.allowedKinds.includes(signal.kind)) return deny("unapproved-kind");
  if (!["info", "warning", "critical"].includes(signal.severity)) return deny("invalid-severity");
  if (!safeId(signal.idempotencyKey)) return deny("invalid-idempotency-key");
  if (!Array.isArray(context.previouslyObservedKeys) || context.previouslyObservedKeys.some(k => !safeId(k))) return deny("missing-idempotency-state");
  if (context.previouslyObservedKeys.includes(signal.idempotencyKey)) return deny("duplicate-signal");
  return { status: "observed", reason: "read-only-unpersisted", signalId: signal.id, evidenceSha: signal.evidenceSha };
}
