#!/usr/bin/env python3
"""F19 isolated guarded SQL compatibility gate. Fake auth is a CI fixture, NOT JWT proof."""
import os,hashlib
from pathlib import Path
import psycopg2
def db():
    c=psycopg2.connect(host=os.environ["PGHOST"],port=os.environ["PGPORT"],
      user=os.environ["PGUSER"],password=os.environ["PGPASSWORD"],dbname=os.environ["PGDATABASE"])
    c.autocommit=True
    return c
path=Path("docs/robotics/f19-guarded-auth-isolated.sql")
with db() as c:
  with c.cursor() as q:
    # Minimal schema fixture is deliberately NOT claimed to be real auth schema.
    q.execute("alter table public.organization_members add column if not exists org_id uuid")
    q.execute("update public.organization_members set org_id=organization_id")
    q.execute("create schema if not exists auth")
    q.execute("""create or replace function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('test.verified_actor',true),'')::uuid$$""")
    q.execute("""create or replace function public.has_identity_permission(o uuid,p text)
      returns boolean language sql stable as
      $$select p='execution.write' and exists(select 1 from public.organization_members
        where org_id=o and user_id=auth.uid() and status='active')$$""")
    print("F19_CANDIDATE_SHA256",hashlib.sha256(path.read_bytes()).hexdigest(),flush=True)
    q.execute(path.read_text())
    q.execute("""select has_function_privilege('authenticated',
      'public.robotics_f19_guarded_complete(text,uuid,text)','EXECUTE')""")
    assert q.fetchone()[0] is False
    print("PASS F19 candidate ungranted to authenticated",flush=True)
    q.execute("select public.robotics_f19_guarded_complete('invalid',null,'proof')")
    assert q.fetchone()[0] is False
    print("PASS F19 missing identity/org fail closed",flush=True)
    q.execute("select public.robotics_f19_guarded_complete('invalid',%s,'proof')",
      ('00000000-0000-0000-0000-000000000001',))
    assert q.fetchone()[0] is False
    print("PASS F19 null identity fail closed",flush=True)
print("F19 fixture-only SQL-load PASS; JWT, real permission schema and role revocation P0",flush=True)
