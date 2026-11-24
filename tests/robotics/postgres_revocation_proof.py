"""Isolated PostgreSQL concurrency contract. No production credentials or hardware."""
import os
import threading
import time
import uuid
import psycopg2

def connection():
    return psycopg2.connect(
        host=os.environ["PGHOST"], port=os.environ["PGPORT"],
        user=os.environ["PGUSER"], password=os.environ["PGPASSWORD"],
        dbname=os.environ["PGDATABASE"], connect_timeout=5
    )

SCHEMA = """
create table robotics_test_grants (
  org_id uuid not null, actor_id uuid not null, enabled boolean not null,
  primary key(org_id,actor_id)
);
create table robotics_test_runs (
  org_id uuid not null, actor_id uuid not null, run_id text not null,
  status text not null, primary key(org_id,actor_id,run_id)
);
create or replace function robotics_test_complete(o uuid, a uuid, r text)
returns boolean language plpgsql as $$
declare allowed boolean;
begin
  select enabled into allowed from robotics_test_grants
    where org_id=o and actor_id=a for update;
  if allowed is distinct from true then return false; end if;
  update robotics_test_runs set status='completed'
    where org_id=o and actor_id=a and run_id=r and status='reserved';
  return found;
end $$;
create or replace function robotics_test_revoke(o uuid,a uuid)
returns void language plpgsql as $$
begin
  update robotics_test_grants set enabled=false
  where org_id=o and actor_id=a;
end $$;
"""
org_a, org_b, actor = (str(uuid.uuid4()) for _ in range(3))
with connection() as c:
    with c.cursor() as cur:
        cur.execute(SCHEMA)
        cur.execute("insert into robotics_test_grants values (%s,%s,true),(%s,%s,true)", (org_a,actor,org_b,actor))
        cur.execute("insert into robotics_test_runs values (%s,%s,'run1','reserved'),(%s,%s,'run1','reserved')", (org_a,actor,org_b,actor))

def scenario(revoke_first):
    with connection() as c:
        with c.cursor() as cur:
            cur.execute("update robotics_test_grants set enabled=true where org_id=%s and actor_id=%s", (org_a,actor))
            cur.execute("update robotics_test_runs set status='reserved' where org_id=%s and actor_id=%s", (org_a,actor))
    acquired=threading.Event()
    release=threading.Event()
    outcome={}
    def first():
        try:
            with connection() as c:
                with c.cursor() as cur:
                    cur.execute("set lock_timeout='5s'")
                    if revoke_first:
                        cur.execute("select robotics_test_revoke(%s,%s)",(org_a,actor))
                    else:
                        cur.execute("select robotics_test_complete(%s,%s,'run1')",(org_a,actor))
                        outcome["first_completed"]=cur.fetchone()[0]
                    acquired.set()
                    if not release.wait(5): raise AssertionError("release timeout")
        except Exception as exc:
            outcome["first_error"]=repr(exc)
            acquired.set()
    def second():
        try:
            with connection() as c:
                with c.cursor() as cur:
                    cur.execute("set lock_timeout='5s'")
                    if revoke_first:
                        cur.execute("select robotics_test_complete(%s,%s,'run1')",(org_a,actor))
                        outcome["second_completed"]=cur.fetchone()[0]
                    else:
                        cur.execute("select robotics_test_revoke(%s,%s)",(org_a,actor))
        except Exception as exc:
            outcome["second_error"]=repr(exc)
    t1=threading.Thread(target=first);t1.start()
    assert acquired.wait(5), "first session failed to acquire lock"
    t2=threading.Thread(target=second);t2.start()
    time.sleep(0.25)
    assert t2.is_alive(), "second transaction did not block on grant lock"
    release.set()
    t1.join(6);t2.join(6)
    assert not t1.is_alive() and not t2.is_alive(), "transaction timeout"
    assert "first_error" not in outcome and "second_error" not in outcome, outcome
    with connection() as c:
        with c.cursor() as cur:
            cur.execute("select enabled from robotics_test_grants where org_id=%s and actor_id=%s",(org_a,actor))
            assert cur.fetchone()[0] is False, "grant not revoked"
            cur.execute("select status from robotics_test_runs where org_id=%s and actor_id=%s",(org_a,actor))
            status=cur.fetchone()[0]
            cur.execute("select enabled from robotics_test_grants where org_id=%s and actor_id=%s",(org_b,actor))
            assert cur.fetchone()[0] is True, "cross-tenant grant altered"
    if revoke_first:
        assert outcome["second_completed"] is False and status=="reserved", outcome
    else:
        assert outcome["first_completed"] is True and status=="completed", outcome
    print("PASS", "revoke-first" if revoke_first else "complete-first", outcome, "tenant-isolated")

scenario(False)
scenario(True)
print("PASS PostgreSQL 17 isolated grant-row serialization; NOT membership/RLS certification")
