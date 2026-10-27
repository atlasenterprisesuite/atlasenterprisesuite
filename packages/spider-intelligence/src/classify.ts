export type SpiderSignal = Readonly<{ tenantId: string; id: string; kind: string; severity: "info" | "warning" | "critical"; evidenceSha: string; observedAt: string; idempotencyKey?: string }>;
export type SpiderContext = Readonly<{ tenantId: string; roles: readonly string[]; allowedKinds: readonly string[]; membershipActive?: boolean; revoked?: boolean; previouslyObservedKeys?: readonly string[] }>;
export type SpiderDecision = Readonly<{ status: "quarantined" | "observed"; reason: string; signalId: string; evidenceSha: string }>;
/** Pure, fail-closed signal classifier. No I/O, credentials, mutations or dispatch. */
export function classifySpiderSignal(signal: SpiderSignal, context: SpiderContext): SpiderDecision {
  const deny = (reason: string): SpiderDecision => ({ status: "quarantined", reason, signalId: signal?.id ?? "", evidenceSha: signal?.evidenceSha ?? "" });
  if (!signal || !context || typeof signal.id !== "string" || !signal.id.trim() || typeof signal.tenantId !== "string" || !signal.tenantId.trim() || typeof signal.kind !== "string" || !signal.kind.trim() || typeof signal.evidenceSha !== "string" || typeof signal.observedAt !== "string" || !Number.isFinite(Date.parse(signal.observedAt))) return deny("invalid-evidence");
  if (!/^[a-f0-9]{40}$/.test(signal.evidenceSha)) return deny("invalid-sha");
  if (signal.tenantId !== context.tenantId) return deny("cross-tenant");
  if (context.membershipActive !== true || context.revoked === true || !Array.isArray(context.roles) || !context.roles.includes("spider:observe")) return deny("membership-or-role-denied");
  if (!Array.isArray(context.allowedKinds) || !context.allowedKinds.includes(signal.kind)) return deny("unapproved-kind");
  if (!["info", "warning", "critical"].includes(signal.severity)) return deny("invalid-severity");
  if (typeof signal.idempotencyKey !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,127}$/.test(signal.idempotencyKey)) return deny("invalid-idempotency-key");
  if (!Array.isArray(context.previouslyObservedKeys)) return deny("missing-idempotency-state");
  if (context.previouslyObservedKeys.includes(signal.idempotencyKey)) return deny("duplicate-signal");
  return { status: "observed", reason: "read-only-unpersisted", signalId: signal.id, evidenceSha: signal.evidenceSha };
}
