#!/usr/bin/env python3
"""Disposable PG17 two-session negative tests; NEVER connect to production."""
import os, subprocess, threading, time, sys
url = os.environ["DATABASE_URL"]
assert url == "postgresql://atlas_test:disposable_only@127.0.0.1:5432/atlas_test", "unsafe database target"
def sql(q, expect_ok=True):
    p = subprocess.run(["psql", url, "-X", "-q", "-v", "ON_ERROR_STOP=1", "-At", "-c", q], capture_output=True, text=True, timeout=20)
    if (p.returncode == 0) != expect_ok:
        raise AssertionError(f"SQL unexpected result: {p.stdout} {p.stderr}")
    return p.stdout.strip(), p.stderr.strip()
sql("SELECT app_factory_test.create_preview('tenant_b','alice','forbidden')", False)
sql("SELECT app_factory_test.create_preview('tenant_a','alice','allowed')")
# Revocation-first ordering: committed revocation must deny.
sql("UPDATE app_factory_test.memberships SET active=false WHERE organization_id='tenant_a' AND actor_id='alice'")
sql("SELECT app_factory_test.create_preview('tenant_a','alice','after revoke')", False)
# Reset only in disposable fixture.
sql("UPDATE app_factory_test.memberships SET active=true WHERE organization_id='tenant_a' AND actor_id='alice'")
ready = threading.Event()
release = threading.Event()
outcomes = {}
def creator():
    q = "BEGIN ISOLATION LEVEL READ COMMITTED; SELECT app_factory_test.create_preview('tenant_a','alice','concurrent'); SELECT pg_sleep(3); COMMIT;"
    ready.set()
    outcomes["creator"] = sql(q)
def revoker():
    ready.wait(timeout=5)
    time.sleep(0.5)
    start = time.monotonic()
    outcomes["revoker"] = sql("UPDATE app_factory_test.memberships SET active=false WHERE organization_id='tenant_a' AND actor_id='alice'")
    outcomes["wait"] = time.monotonic() - start
a = threading.Thread(target=creator); b = threading.Thread(target=revoker)
a.start(); b.start(); a.join(timeout=15); b.join(timeout=15)
assert not a.is_alive() and not b.is_alive(), "sessions hung"
assert outcomes.get("wait", 0) >= 1.0, f"revocation did not wait for membership lock: {outcomes}"
sql("SELECT app_factory_test.create_preview('tenant_a','alice','post-concurrent-revoke')", False)
print("PASS: tenant A/B negative, revocation-first, concurrent lock serialization, post-revocation denial")
print("LIMITATION: fixture is synthetic and does not validate real Supabase RLS or caller identity")
