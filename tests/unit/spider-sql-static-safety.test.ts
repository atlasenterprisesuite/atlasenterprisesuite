import { describe, expect, it } from "vitest";
import { inspectReadOnlySql } from "./spider-sql-static-safety";
const wrap = (statement: string) => `BEGIN READ ONLY; ${statement}; ROLLBACK;`;
describe("Spider SQL lexical safety negative cases", () => {
 it("accepts read-only SELECT with quoted keywords and comments", () => expect(inspectReadOnlySql(wrap("SELECT 'DELETE', 'UPDATE' /* DROP */ -- ALTER\n FROM pg_class")).safe).toBe(true));
 it("rejects direct mutation", () => expect(inspectReadOnlySql(wrap("DELETE FROM public.audit_logs")).safe).toBe(false));
 it("rejects nested data-modifying CTE", () => expect(inspectReadOnlySql(wrap("WITH x AS (DELETE FROM public.audit_logs RETURNING id) SELECT * FROM x")).safe).toBe(false));
 it("rejects write after read statement", () => expect(inspectReadOnlySql("BEGIN READ ONLY; SELECT 1; INSERT INTO x VALUES (1); ROLLBACK;").safe).toBe(false));
 it("rejects dollar-quoted SQL execution", () => expect(inspectReadOnlySql(wrap("DO $$ BEGIN DELETE FROM x; END $$")).safe).toBe(false));
 it("rejects unterminated block comment", () => expect(inspectReadOnlySql(wrap("SELECT 1 /*")).safe).toBe(false));
 it("rejects missing transaction envelope", () => expect(inspectReadOnlySql("SELECT 1;").safe).toBe(false));
 it("rejects COMMIT instead of rollback", () => expect(inspectReadOnlySql("BEGIN READ ONLY; SELECT 1; COMMIT;").safe).toBe(false));
 it("accepts quoted semicolon without splitting", () => expect(inspectReadOnlySql(wrap("SELECT ';'")).safe).toBe(true));
});
