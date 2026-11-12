// @vitest-environment node
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
const org = "11111111-1111-4111-8111-111111111111",
  other = "22222222-2222-4222-8222-222222222222",
  user = "33333333-3333-4333-8333-333333333333",
  debit = "44444444-4444-4444-8444-444444444444",
  credit = "55555555-5555-4555-8555-555555555555";
let db: PGlite;
let actor: string | null = user;
const rows = [
  {
    reference: "R1",
    date: "2026-11-11",
    description: "Sale",
    amountMinor: 1234,
    currency: "USD",
  },
];
async function run(data: unknown = rows, target = org) {
  return db.query<any>(
    "select public.import_google_sheet_drafts($1,$2,$3,$4,$5,$6,$7::jsonb) result",
    [actor, target, "file1", "Ledger", debit, credit, JSON.stringify(data)],
  );
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function public.has_identity_permission(uuid,text) returns boolean language sql stable as $$select $1='${org}'::uuid and auth.uid()='${user}'::uuid$$;
 create table chart_of_accounts(id uuid primary key, org_id uuid,active boolean default true);
 create table journal_entries(id uuid primary key default gen_random_uuid(),org_id uuid,entry_number text,entry_date date,memo text,status text,created_by uuid);
 create table journal_lines(id uuid primary key default gen_random_uuid(),org_id uuid,journal_entry_id uuid references journal_entries(id),account_id uuid,debit numeric,credit numeric);
 create table atlas_integration_connections(id uuid primary key default gen_random_uuid(),org_id uuid,provider text,connection_name text,authorized boolean,provider_verified boolean,state text);
 create table atlas_external_object_links(id uuid primary key default gen_random_uuid(),org_id uuid,provider text,provider_account_id text,provider_object_type text,provider_object_id text,atlas_object_type text,atlas_object_id uuid,last_seen_at timestamptz,source_fingerprint text);
 create table atlas_integration_sync_runs(id uuid primary key default gen_random_uuid(),org_id uuid,provider text,operation text,object_type text,status text,records_observed int,started_by uuid,completed_at timestamptz);
 insert into chart_of_accounts values('${debit}','${org}',true),('${credit}','${org}',true);
 insert into atlas_integration_connections(org_id,provider,connection_name,authorized,provider_verified,state) values('${org}','google','workspace-sheets:${user}',true,true,'connected');
 set request.jwt.claim.sub='${user}';`);
  await db.exec(
    readFileSync(
      "supabase/migrations/20261112004817_google_workspace_journal_import.sql",
      "utf8",
    ),
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
describe("Google Sheets atomic accounting import", () => {
  it("prevents browser callers from bypassing the server preview", async () => {
    await db.exec("set role authenticated");
    await expect(run()).rejects.toThrow(/permission denied/);
    await db.exec("reset role");
  });
  it("creates balanced drafts and safely retries the same references", async () => {
    expect((await run()).rows[0].result).toEqual({
      imported: 1,
      duplicates: 0,
    });
    expect((await run()).rows[0].result).toEqual({
      imported: 0,
      duplicates: 1,
    });
    expect(
      (await db.query<any>("select count(*)::int n from journal_entries"))
        .rows[0].n,
    ).toBe(1);
    expect(
      (
        await db.query<any>(
          "select sum(debit)=sum(credit) balanced from journal_lines",
        )
      ).rows[0].balanced,
    ).toBe(true);
  });
  it("rejects changed references and rolls back every row in the batch", async () => {
    await expect(
      run([
        { ...rows[0], reference: "new" },
        { ...rows[0], amountMinor: 222 },
      ]),
    ).rejects.toThrow(/reference_conflict/);
    expect(
      (await db.query<any>("select count(*)::int n from journal_entries"))
        .rows[0].n,
    ).toBe(1);
  });
  it("denies cross-organization, unauthenticated, invalid dates, zero amounts and repeated references", async () => {
    await expect(run(rows, other)).rejects.toThrow(/permission/);
    await expect(run([{ ...rows[0], date: "2026-02-30" }])).rejects.toThrow();
    await expect(run([{ ...rows[0], amountMinor: 0 }])).rejects.toThrow(
      /invalid/,
    );
    await expect(run([rows[0], rows[0]])).rejects.toThrow(/duplicate/);
    actor = null;
    await expect(run()).rejects.toThrow(/permission/);
    actor = user;
  });
  it("blocks revoked connections at commit and writes audit only for successful transactions", async () => {
    await db.exec(
      `update atlas_integration_connections set state='revoked',authorized=false`,
    );
    await expect(run([{ ...rows[0], reference: "revoked" }])).rejects.toThrow(
      /not_connected/,
    );
    expect(
      (
        await db.query<any>(
          "select count(*)::int n from atlas_integration_sync_runs",
        )
      ).rows[0].n,
    ).toBe(2);
  });
});
