import { describe, expect, it } from "vitest";
import { classifySpiderSignal } from "../../packages/spider-intelligence/src/classify";

const signal = { tenantId: "tenant-a", id: "event-1", kind: "ci.failure", severity: "critical" as const, evidenceSha: "a".repeat(40), observedAt: "2026-10-27T00:00:00Z", idempotencyKey: "event-1" };
const ctx = { tenantId: "tenant-a", roles: ["spider:observe"], allowedKinds: ["ci.failure"], membershipActive: true, revoked: false, previouslyObservedKeys: [] as string[] };

describe("Spider Intelligence fail-closed contract", () => {
  it("observes authorized evidence without dispatching actions", () => expect(classifySpiderSignal(signal, ctx).status).toBe("observed"));
  it("quarantines cross-tenant signals", () => expect(classifySpiderSignal({ ...signal, tenantId: "tenant-b" }, ctx).reason).toBe("cross-tenant"));
  it("quarantines revoked roles", () => expect(classifySpiderSignal(signal, { ...ctx, roles: [] }).status).toBe("quarantined"));
  it("quarantines revoked membership", () => expect(classifySpiderSignal(signal, { ...ctx, revoked: true }).status).toBe("quarantined"));
  it("quarantines inactive membership", () => expect(classifySpiderSignal(signal, { ...ctx, membershipActive: false }).status).toBe("quarantined"));
  it("quarantines unknown event kinds", () => expect(classifySpiderSignal({ ...signal, kind: "payment.transfer" }, ctx).reason).toBe("unapproved-kind"));
  it("quarantines unverifiable SHAs", () => expect(classifySpiderSignal({ ...signal, evidenceSha: "unknown" }, ctx).reason).toBe("invalid-sha"));
  it("quarantines missing evidence", () => expect(classifySpiderSignal({ ...signal, observedAt: "" }, ctx).reason).toBe("invalid-evidence"));
  it("quarantines duplicate signals", () => expect(classifySpiderSignal(signal, { ...ctx, previouslyObservedKeys: ["event-1"] }).reason).toBe("duplicate-signal"));
  it("quarantines missing idempotency state", () => expect(classifySpiderSignal(signal, { ...ctx, previouslyObservedKeys: undefined as never }).reason).toBe("missing-idempotency-state"));
  it("quarantines missing idempotency key", () => expect(classifySpiderSignal({ ...signal, idempotencyKey: undefined }, ctx).reason).toBe("invalid-idempotency-key"));
});
