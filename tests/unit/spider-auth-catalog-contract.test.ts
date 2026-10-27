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
 it("inspects raw table and schema ACLs", () => { expect(sql).toContain("c.relacl"); expect(sql).toContain("n.nspacl"); });
 it("checks effective table and schema permissions", () => { expect(sql).toContain("has_table_privilege"); expect(sql).toContain("has_schema_privilege"); });
 it("checks role inheritance and RLS bypass", () => { expect(sql).toContain("pg_auth_members"); expect(sql).toContain("rolinherit"); expect(sql).toContain("rolbypassrls"); });
 it("checks default ACLs", () => expect(sql).toContain("pg_default_acl"));
 it("checks function execute and security definer flags", () => { expect(sql).toContain("has_function_privilege"); expect(sql).toContain("p.prosecdef"); });
 it("rejects SQL mutations only at statement boundaries", () => {\n  const statements = sql.replace(/--[^\n]*/g, "").split(";").map(part => part.trim());\n  expect(statements.filter(Boolean).every(part => !/^(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|TRUNCATE|GRANT|REVOKE|CALL|DO)\\b/i.test(part))).toBe(true);\n });\n it("never invokes database functions through CALL or DO blocks", () => expect(sql.replace(/--[^\n]*/g, "")).not.toMatch(/^\s*(CALL|DO)\b/im));
});
