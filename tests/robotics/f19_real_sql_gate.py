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
        for name, signature in (("reserve","text,uuid,uuid,text"),("complete","text,uuid,uuid,text"),("revoke","text,uuid,uuid"),("halt","text,uuid,uuid,text"),("is_halted","text,uuid,uuid,text")):
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
                params = "'tenant','00000000-0000-0000-0000-000000000001'::uuid,'00000000-0000-0000-0000-000000000002'::uuid"
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
print("F19 SQL-load and ACL subset passed; actor binding and concurrent membership/role revocation NOT certified", flush=True)
conn.close()
