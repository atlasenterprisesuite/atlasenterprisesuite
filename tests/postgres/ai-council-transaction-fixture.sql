-- Disposable PostgreSQL integration fixture for AI Council transaction semantics.
-- Runs only in CI service container; intentionally independent of production schema.
CREATE ROLE atlas_council_app NOLOGIN;
CREATE SCHEMA fixture;
CREATE TABLE fixture.approvals (
 id text PRIMARY KEY, org_id text NOT NULL, requester_id text NOT NULL,
 proposal_hash text NOT NULL, status text NOT NULL, expires_at timestamptz NOT NULL
);
CREATE TABLE fixture.consumptions (
 approval_id text PRIMARY KEY REFERENCES fixture.approvals(id),
 org_id text NOT NULL, requester_id text NOT NULL, proposal_hash text NOT NULL
);
CREATE TABLE fixture.audit_events (
 id bigserial PRIMARY KEY, approval_id text NOT NULL, org_id text NOT NULL, action text NOT NULL
);
CREATE OR REPLACE FUNCTION fixture.consume_approved_action(
 p_approval_id text,p_org_id text,p_user_id text,p_proposal_hash text,p_fail_audit boolean DEFAULT false
) RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v fixture.approvals%rowtype;
BEGIN
 SELECT * INTO v FROM fixture.approvals
 WHERE id=p_approval_id AND org_id=p_org_id AND requester_id=p_user_id
 AND proposal_hash=p_proposal_hash AND status='approved' AND expires_at>clock_timestamp()
 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'approval_invalid'; END IF;
 INSERT INTO fixture.consumptions(approval_id,org_id,requester_id,proposal_hash)
 VALUES(v.id,p_org_id,p_user_id,p_proposal_hash);
 IF p_fail_audit THEN RAISE EXCEPTION 'audit_injected_failure'; END IF;
 INSERT INTO fixture.audit_events(approval_id,org_id,action)
 VALUES(v.id,p_org_id,'approval_consumed');
 RETURN 'consumed';
END $$;
REVOKE ALL ON SCHEMA fixture FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA fixture FROM PUBLIC;
REVOKE ALL ON FUNCTION fixture.consume_approved_action(text,text,text,text,boolean) FROM PUBLIC;
