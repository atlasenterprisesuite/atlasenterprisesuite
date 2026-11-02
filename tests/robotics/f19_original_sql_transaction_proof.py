#!/usr/bin/env python3
"""F19 isolated transaction orchestration proof over original Robotics SQL.
Privileged disposable CI fixture ONLY. Does not certify production identity/RLS.
"""
import os
import threading
import time
import uuid
import psycopg2

def connect():
    c = psycopg2.connect(host=os.environ["PGHOST"],port=os.environ["PGPORT"],
        user=os.environ["PGUSER"],password=os.environ["PGPASSWORD"],
        dbname=os.environ["PGDATABASE"],connect_timeout=5)
    c.autocommit = False
    return c

a,b,actor,other = [str(uuid.uuid4()) for _ in range(4)]
with connect() as c:
    with c.cursor() as q:
        q.execute("insert into public.organizations(id) values (%s),(%s)",(a,b))
        q.execute("""insert into public.organization_members(id,organization_id,user_id,status)
          values (%s,%s,%s,'active'),(%s,%s,%s,'active')""",
          (str(uuid.uuid4()),a,actor,str(uuid.uuid4()),b,other))
        q.execute("""insert into public.atlas_robotics_simulation_grants(tenant_id,org_id,actor_id,enabled)
          values ('tenant-a',%s,%s,true),('tenant-b',%s,%s,true)""",(a,actor,b,other))
        q.execute("""insert into public.atlas_robotics_simulation_runs(tenant_id,org_id,run_id,status)
          values ('tenant-a',%s,'proof','reserved'),('tenant-b',%s,'proof','reserved')""",(a,b))

def complete(c, org, identity, tenant):
    with c.cursor() as q:
        # Trusted identity must come from verified server context, not user parameters.
        # Lock membership before the Robotics grant lock. Revoker locks same row.
        q.execute("""select status from public.organization_members
          where organization_id=%s and user_id=%s for update""",(org,identity))
        row=q.fetchone()
        if row is None or row[0] != "active": return False
        q.execute("select public.robotics_simulation_complete(%s,%s,%s,'proof')",
                  (tenant,org,identity))
        return q.fetchone()[0]

def revoke(c, org, identity):
    with c.cursor() as q:
        q.execute("""update public.organization_members set status='revoked'
          where organization_id=%s and user_id=%s""",(org,identity))

def scenario(revoke_first):
    with connect() as c:
        with c.cursor() as q:
            q.execute("update public.organization_members set status='active' where organization_id=%s",(a,))
            q.execute("update public.atlas_robotics_simulation_runs set status='reserved' where org_id=%s",(a,))
    entered=threading.Event()
    release=threading.Event()
    result={}
    def first():
        try:
            with connect() as c:
                with c.cursor() as q:
                    q.execute("set local lock_timeout='5s'")
                if revoke_first: revoke(c,a,actor)
                else: result["first"]=complete(c,a,actor,"tenant-a")
                entered.set()
                assert release.wait(5)
        except Exception as e:
            result["first_error"]=repr(e)
            entered.set()
    def second():
        try:
            with connect() as c:
                with c.cursor() as q:
                    q.execute("set local lock_timeout='5s'")
                if revoke_first: result["second"]=complete(c,a,actor,"tenant-a")
                else: revoke(c,a,actor)
        except Exception as e:
            result["second_error"]=repr(e)
    t1=threading.Thread(target=first)
    t2=threading.Thread(target=second)
    t1.start()
    assert entered.wait(5)
    t2.start()
    time.sleep(.25)
    assert t2.is_alive(), "second transaction must wait for membership lock"
    release.set()
    t1.join(6)
    t2.join(6)
    assert not t1.is_alive() and not t2.is_alive(),result
    assert not any(k.endswith("_error") for k in result),result
    with connect() as c:
        assert complete(c,a,actor,"tenant-a") is False, "post-revoke must deny"
        with c.cursor() as q:
            q.execute("select status from public.atlas_robotics_simulation_runs where org_id=%s",(a,))
            state=q.fetchone()[0]
            q.execute("select status from public.atlas_robotics_simulation_runs where org_id=%s",(b,))
            assert q.fetchone()[0]=="reserved", "B must remain isolated"
            q.execute("select status from public.organization_members where organization_id=%s",(b,))
            assert q.fetchone()[0]=="active", "B membership must remain active"
    if revoke_first: assert result["second"] is False and state=="reserved",result
    else: assert result["first"] is True and state=="completed",result
    print("PASS F19 original-SQL membership concurrency",
          "revoke-first" if revoke_first else "complete-first",result,flush=True)

with connect() as c:
    assert complete(c,a,other,"tenant-a") is False, "actor spoof denied"
    assert complete(c,b,actor,"tenant-b") is False, "cross-organization denied"
    assert complete(c,a,actor,"tenant-b") is False, "tenant mismatch denied"
print("PASS F19 original-SQL isolated negative actor/org/tenant",flush=True)
scenario(False)
scenario(True)
print("PASS F19 original-SQL isolated transaction adapter; NOT authenticated RLS/permission certification",flush=True)
