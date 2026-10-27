import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const sql = readFileSync(new URL("../fixtures/spider-auth-catalog-readonly.sql", import.meta.url), "utf8");
describe("Spider catalog inspector static safety contract (not a DB execution)", () => {
 it("starts read only", () => expect(sql).toMatch(/^BEGIN READ ONLY;/m));
 it("ends rollback", () => expect(sql).toMatch(/^ROLLBACK;/m));
 it("restricts scope to the two shared public tables", () => expect(sql).toContain("c.relname IN ('organization_members','audit_logs')"));
 it("inspects constraints", () => expect(sql).toContain("pg_get_constraintdef"));
 it("inspects indexes", () => expect(sql).toContain("pg_get_indexdef"));
 it("inspects RLS and policies", () => { expect(sql).toContain("relrowsecurity"); expect(sql).toContain("pg_policies"); });
 it("inspects triggers and grants", () => { expect(sql).toContain("pg_get_triggerdef"); expect(sql).toContain("role_table_grants"); });
 it("contains no SQL mutations", () => expect(sql.replace(/--[^\n]*/g, "")).not.toMatch(/\b(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|TRUNCATE|GRANT|REVOKE|CALL)\s/i));
});
