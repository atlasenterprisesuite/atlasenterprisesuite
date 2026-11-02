#!/usr/bin/env python3
"""F19: execute original Robotics SQL against disposable PostgreSQL 17."""
import hashlib
import os
from pathlib import Path
import psycopg2

FILES = [
    Path("supabase/migrations/20261101_robotics_simulation_isolated_draft.sql"),
    Path("docs/robotics/phase5-postgres-isolated-prototype.sql"),
]
conn = psycopg2.connect(host=os.environ["PGHOST"], port=os.environ["PGPORT"], dbname=os.environ["PGDATABASE"], user=os.environ["PGUSER"], password=os.environ["PGPASSWORD"])
conn.autocommit = True
with conn.cursor() as cur:
    cur.execute("select version()")
    print("POSTGRES_VERSION", cur.fetchone()[0], flush=True)
    print("GITHUB_SHA", os.environ.get("GITHUB_SHA", "local"), flush=True)
    cur.execute("create table if not exists public.organizations(id uuid primary key)")
    cur.execute("create table if not exists public.organization_members(id uuid primary key, organization_id uuid references public.organizations(id), user_id uuid, status text)")
    cur.execute("select rolname from pg_roles where rolname in ('anon','authenticated')")
    existing = {r[0] for r in cur.fetchall()}
    for role in ("anon", "authenticated"):
        if role not in existing:
            cur.execute("create role " + role + " nologin")
    cur.execute("create schema if not exists auth")
    cur.execute("""create or replace function auth.uid() returns uuid language sql stable as
      $select nullif(current_setting('test.verified_actor',true),'')::uuid$""")
    for file in FILES:
        sql = file.read_bytes()
        print("SQL_SHA256", file, hashlib.sha256(sql).hexdigest(), flush=True)
        cur.execute(sql.decode("utf-8"))
    cur.execute("""
        select relname, relrowsecurity, relforcerowsecurity
        from pg_class where relname in ('atlas_robotics_simulation_runs','atlas_robotics_simulation_grants')
        order by relname
    """)
    rows = cur.fetchall()
    assert len(rows) == 2 and all(x[1] and x[2] for x in rows), rows
    print("PASS RLS enabled and forced", rows, flush=True)
    cur.execute("select tablename, policyname from pg_policies where tablename in ('atlas_robotics_simulation_runs','atlas_robotics_simulation_grants')")
    policies = cur.fetchall()
    assert not policies, policies
    print("PASS no permissive policies", flush=True)
    for role in ("anon", "authenticated"):
        for table in ("atlas_robotics_simulation_runs", "atlas_robotics_simulation_grants"):
            cur.execute("select has_table_privilege(%s,%s,'SELECT') or has_table_privilege(%s,%s,'INSERT') or has_table_privilege(%s,%s,'UPDATE') or has_table_privilege(%s,%s,'DELETE')", (role, "public."+table, role, "public."+table, role, "public."+table, role, "public."+table))
            assert not cur.fetchone()[0], (role, table)
        for name, signature in (("reserve","text,uuid,text"),("complete","text,uuid,text"),("revoke","text,uuid"),("halt","text,uuid,text"),("is_halted","text,uuid,text")):
            cur.execute("select has_function_privilege(%s,%s,'EXECUTE')", (role, "public.robotics_simulation_"+name+"("+signature+")"))
            assert not cur.fetchone()[0], (role, name)
    print("PASS anon/authenticated ACL denies both tables and all 5 functions", flush=True)

    # Real role-context denial, rather than relying only on owner-side ACL inspection.
    for role in ("anon", "authenticated"):
        cur.execute("set role " + role)
        try:
            for table in ("atlas_robotics_simulation_runs", "atlas_robotics_simulation_grants"):
                try:
                    cur.execute("select count(*) from public." + table)
                except psycopg2.errors.InsufficientPrivilege:
                    print("PASS role denied table", role, table, flush=True)
                else:
                    raise AssertionError(("table readable by", role, table))
            for fn in ("reserve", "complete", "revoke", "halt", "is_halted"):
                params = "'tenant','00000000-0000-0000-0000-000000000001'::uuid"
                if fn in ("reserve", "complete", "halt", "is_halted"):
                    params += ",'test_run'"
                try:
                    cur.execute("select public.robotics_simulation_" + fn + "(" + params + ")")
                except psycopg2.errors.InsufficientPrivilege:
                    print("PASS role denied function", role, fn, flush=True)
                else:
                    raise AssertionError(("function callable by", role, fn))
        finally:
            cur.execute("reset role")
    print("PASS direct nonprivileged SQL denial", flush=True)

    # Cross-tenant and actor-spoof attempts must fail closed for both API roles.
    # No privileged bypass is introduced: real positive authorization remains P0.
    import uuid
    org_a, org_b, actor_a, actor_b = [str(uuid.uuid4()) for _ in range(4)]
    cur.execute("insert into public.organizations(id) values (%s),(%s)", (org_a,org_b))
    cur.execute("insert into public.organization_members(id,organization_id,user_id,status) values (%s,%s,%s,'active'),(%s,%s,%s,'active')",
                (str(uuid.uuid4()),org_a,actor_a,str(uuid.uuid4()),org_b,actor_b))
    for role in ("anon", "authenticated"):
        cur.execute("set role " + role)
        try:
            for tenant, org, claimed_actor in (("tenant-a",org_a,actor_a),
                                               ("tenant-b",org_b,actor_a),
                                               ("tenant-a",org_a,actor_b)):
                for operation in ("reserve", "complete", "halt"):
                    try:
                        cur.execute("select public.robotics_simulation_" + operation +
                                    "(%s,%s::uuid,%s)",
                                    (tenant,org,"f19_negative"))
                    except psycopg2.errors.InsufficientPrivilege:
                        print("PASS fail-closed spoof/tenant", role, operation, tenant, flush=True)
                    else:
                        raise AssertionError(("unsafe RPC exposure",role,operation,tenant))
        finally:
            cur.execute("reset role")
    print("PASS cross-tenant and actor-spoof denial; positive authorization NOT certified",flush=True)
print("F19 SQL-load and ACL subset passed; actor binding and concurrent membership/role revocation NOT certified", flush=True)
conn.close()
