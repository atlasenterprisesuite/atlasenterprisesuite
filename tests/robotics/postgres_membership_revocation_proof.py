"""Isolated PostgreSQL membership-revocation concurrency proof (not production schema)."""
import os
import threading
import time
import uuid
import psycopg2

def db():
    return psycopg2.connect(
        host=os.environ["PGHOST"], port=os.environ["PGPORT"],
        user=os.environ["PGUSER"], password=os.environ["PGPASSWORD"],
        dbname=os.environ["PGDATABASE"], connect_timeout=5)

org, other_org, actor = [str(uuid.uuid4()) for _ in range(3)]
with db() as c:
    with c.cursor() as q:
        q.execute("""
            create table test_members (
              org_id uuid not null, user_id uuid not null, status text not null,
              primary key (org_id,user_id));
            create table test_runs (
              org_id uuid not null, user_id uuid not null, run_id text not null,
              status text not null, primary key (org_id,user_id,run_id));
            create function test_complete(o uuid,u uuid,r text) returns boolean
              language plpgsql as $$
              declare active boolean;
              begin
                select status='active' into active from test_members
                  where org_id=o and user_id=u for update;
                if active is distinct from true then return false; end if;
                update test_runs set status='completed' where
                  org_id=o and user_id=u and run_id=r and status='reserved';
                return found;
              end $$;
            create function test_revoke(o uuid,u uuid) returns void
              language plpgsql as $$
              begin
                update test_members set status='revoked'
                  where org_id=o and user_id=u;
              end $$;
        """)
        q.execute("insert into test_members values (%s,%s,'active'),(%s,%s,'active')",
                  (org,actor,other_org,actor))
        q.execute("insert into test_runs values (%s,%s,'run','reserved'),(%s,%s,'run','reserved')",
                  (org,actor,other_org,actor))

def scenario(revoke_first):
    with db() as c:
        with c.cursor() as q:
            q.execute("update test_members set status='active' where org_id=%s",(org,))
            q.execute("update test_runs set status='reserved' where org_id=%s",(org,))
    locked = threading.Event()
    release = threading.Event()
    results = {}
    def first():
        try:
            with db() as c:
                with c.cursor() as q:
                    q.execute("set lock_timeout='5s'")
                    if revoke_first:
                        q.execute("select test_revoke(%s,%s)",(org,actor))
                    else:
                        q.execute("select test_complete(%s,%s,'run')",(org,actor))
                        results['first'] = q.fetchone()[0]
                    locked.set()
                    assert release.wait(5)
        except Exception as exc:
            results['error_first'] = str(exc)
            locked.set()
    def second():
        try:
            with db() as c:
                with c.cursor() as q:
                    q.execute("set lock_timeout='5s'")
                    if revoke_first:
                        q.execute("select test_complete(%s,%s,'run')",(org,actor))
                        results['second'] = q.fetchone()[0]
                    else:
                        q.execute("select test_revoke(%s,%s)",(org,actor))
        except Exception as exc:
            results['error_second'] = str(exc)
    a=threading.Thread(target=first)
    b=threading.Thread(target=second)
    a.start()
    assert locked.wait(5)
    b.start()
    time.sleep(0.25)
    assert b.is_alive(), "expected second transaction to wait for membership lock"
    release.set()
    a.join(6)
    b.join(6)
    assert not a.is_alive() and not b.is_alive()
    assert not any(k.startswith('error') for k in results),results
    with db() as c:
        with c.cursor() as q:
            q.execute("select status from test_members where org_id=%s",(org,))
            assert q.fetchone()[0]=='revoked'
            q.execute("select status from test_members where org_id=%s",(other_org,))
            assert q.fetchone()[0]=='active'
            q.execute("select status from test_runs where org_id=%s",(org,))
            state=q.fetchone()[0]
    if revoke_first:
        assert results['second'] is False and state=='reserved',results
    else:
        assert results['first'] is True and state=='completed',results
    print("PASS membership lock ordering", "revoke-first" if revoke_first else "complete-first",results)

scenario(False)
scenario(True)
print("PASS isolated membership concurrency, not production RLS certification")
