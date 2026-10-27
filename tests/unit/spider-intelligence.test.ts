import { describe, expect, it } from "vitest";
import { classifySpiderSignal } from "../../packages/spider-intelligence/src/classify";

const signal = { tenantId: "tenant-a", id: "event-1", kind: "ci.failure", severity: "critical" as const, evidenceSha: "a".repeat(40), observedAt: "2026-10-27T00:00:00Z" };
const ctx = { tenantId: "tenant-a", roles: ["spider:observe"], allowedKinds: ["ci.failure"] };

describe("Spider Intelligence fail-closed contract", () => {
  it("observes authorized evidence without dispatching actions", () => expect(classifySpiderSignal(signal, ctx).status).toBe("observed"));
  it("quarantines cross-tenant signals", () => expect(classifySpiderSignal({ ...signal, tenantId: "tenant-b" }, ctx).reason).toBe("cross-tenant"));
  it("quarantines revoked roles", () => expect(classifySpiderSignal(signal, { ...ctx, roles: [] }).reason).toBe("missing-role"));
  it("quarantines unknown event kinds", () => expect(classifySpiderSignal({ ...signal, kind: "payment.transfer" }, ctx).reason).toBe("unapproved-kind"));
  it("quarantines unverifiable SHAs", () => expect(classifySpiderSignal({ ...signal, evidenceSha: "unknown" }, ctx).reason).toBe("invalid-sha"));
  it("quarantines missing evidence", () => expect(classifySpiderSignal({ ...signal, observedAt: "" }, ctx).reason).toBe("invalid-evidence"));
});
