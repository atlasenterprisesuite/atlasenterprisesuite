export type SpiderSignal = Readonly<{ tenantId: string; id: string; kind: string; severity: "info" | "warning" | "critical"; evidenceSha: string; observedAt: string }>;
export type SpiderContext = Readonly<{ tenantId: string; roles: readonly string[]; allowedKinds: readonly string[] }>;
export type SpiderDecision = Readonly<{ status: "quarantined" | "observed"; reason: string; signalId: string; evidenceSha: string }>;
/** Pure, fail-closed signal classifier. No I/O, credentials, mutations or dispatch. */
export function classifySpiderSignal(signal: SpiderSignal, context: SpiderContext): SpiderDecision {
  const deny = (reason: string): SpiderDecision => ({ status: "quarantined", reason, signalId: signal?.id ?? "", evidenceSha: signal?.evidenceSha ?? "" });
  if (!signal || !context || !signal.id || !signal.tenantId || !signal.kind || !signal.evidenceSha || !Number.isFinite(Date.parse(signal.observedAt))) return deny("invalid-evidence");
  if (!/^[a-f0-9]{40}$|^[a-f0-9]{64}$/i.test(signal.evidenceSha)) return deny("invalid-sha");
  if (signal.tenantId !== context.tenantId) return deny("cross-tenant");
  if (!context.roles.includes("spider:observe")) return deny("missing-role");
  if (!context.allowedKinds.includes(signal.kind)) return deny("unapproved-kind");
  if (!["info", "warning", "critical"].includes(signal.severity)) return deny("invalid-severity");
  return { status: "observed", reason: "read-only", signalId: signal.id, evidenceSha: signal.evidenceSha };
}
