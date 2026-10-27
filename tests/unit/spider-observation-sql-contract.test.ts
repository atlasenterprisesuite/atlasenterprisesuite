import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql = readFileSync(new URL("../fixtures/spider-observation-atomic-isolated.sql", import.meta.url), "utf8");
describe("Spider observation isolation fixture (static contract, not PostgreSQL verification)", () => {
  it("is rollback-only", () => { expect(sql).toMatch(/^BEGIN;/m); expect(sql).toMatch(/^ROLLBACK;/m); });
  it("uses tenant-scoped atomic unique keys", () => expect(sql).toMatch(/UNIQUE \(tenant_id, idempotency_key\)/));
  it("has tenant-scoped receipts", () => expect(sql).toMatch(/UNIQUE \(tenant_id, audit_receipt_id\)/));
  it("enables RLS on membership and observations", () => { expect(sql).toMatch(/ALTER TABLE spider_test.members ENABLE ROW LEVEL SECURITY/); expect(sql).toMatch(/ALTER TABLE spider_test.observations ENABLE ROW LEVEL SECURITY/); });
  it("does not expose an executable privileged RPC", () => { expect(sql).not.toMatch(/SECURITY DEFINER|GRANT EXECUTE|CREATE (OR REPLACE )?FUNCTION/i); });
  it("revokes public access", () => expect(sql).toMatch(/REVOKE ALL ON ALL TABLES IN SCHEMA spider_test FROM PUBLIC/));
  it("rejects invalid evidence sha at the schema boundary", () => expect(sql).toContain("CHECK (evidence_sha ~ '^[a-f0-9]{40}$')"));
});
