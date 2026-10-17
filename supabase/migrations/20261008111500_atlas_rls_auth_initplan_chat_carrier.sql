-- ATLAS 777 REVIEW / GitHub #712
-- Optimize the session-constant auth.uid() checks in the 13 existing Chat and
-- Carrier SELECT policies. No policies are added/deleted, and no permissions
-- or membership predicates are redefined.
--
-- Intentionally read pg_policies rather than replaying old migration text:
-- later security migrations move atlas_chat_can_access into the private schema.
-- Replaying an earlier policy would silently revert those security changes.
--
-- This DO statement executes atomically as one PostgreSQL statement:
-- preflight every target first, then change policies, or fail closed/roll back.

DO $atlas_rls_initplan$
DECLARE
  v_target record;
  v_policy record;
  v_total integer := 0;
  v_optimized text;
BEGIN
  -- Phase 1: verify all 13 deployed policy contracts before any change.
  FOR v_target IN
    SELECT *
    FROM (VALUES
      ('atlas_chat_retention_policies', 'atlas_chat_retention_read', 'organization_members'),
      ('atlas_chat_conversations', 'atlas_chat_conversation_read', 'atlas_chat_can_access'),
      ('atlas_chat_participants', 'atlas_chat_participant_read', 'atlas_chat_can_access'),
      ('atlas_chat_messages', 'atlas_chat_message_read', 'atlas_chat_can_access'),
      ('atlas_chat_message_receipts', 'atlas_chat_receipt_read', 'atlas_chat_can_access'),
      ('atlas_chat_message_reactions', 'atlas_chat_reaction_read', 'atlas_chat_can_access'),
      ('atlas_chat_deletion_requests', 'atlas_chat_deletion_read', 'requested_by'),
      ('atlas_chat_attachments', 'atlas_chat_attachment_read', 'scan_status'),
      ('atlas_numbering_authorizations', 'atlas_numbering_authorizations_member_read', 'organization_members'),
      ('atlas_number_resources', 'atlas_number_resources_member_read', 'organization_members'),
      ('atlas_telephony_providers', 'atlas_telephony_providers_member_read', 'organization_members'),
      ('atlas_call_sessions', 'atlas_call_sessions_member_read', 'organization_members'),
      ('atlas_call_events', 'atlas_call_events_member_read', 'organization_members')
    ) AS targets(tablename, policyname, guard_fragment)
  LOOP
    SELECT p.* INTO v_policy
    FROM pg_policies p
    JOIN pg_namespace n ON n.nspname = p.schemaname
    JOIN pg_class c ON c.relnamespace = n.oid AND c.relname = p.tablename
    WHERE p.schemaname = 'public'
      AND p.tablename = v_target.tablename
      AND p.policyname = v_target.policyname
      AND c.relkind IN ('r', 'p')
      AND c.relrowsecurity;

    IF NOT FOUND
       OR v_policy.qual IS NULL
       OR v_policy.roles::text <> '{authenticated}'
       OR v_policy.cmd <> 'SELECT'
       OR v_policy.permissive <> 'PERMISSIVE'
       OR position(v_target.guard_fragment IN coalesce(v_policy.qual, '')) = 0
       OR position('auth.uid()' IN coalesce(v_policy.qual, '')) = 0
    THEN
      RAISE EXCEPTION 'ATLAS RLS preflight failed for public.%, policy %',
        v_target.tablename, v_target.policyname;
    END IF;

    -- Guard against stripping chat-participation or clean-attachment checks.
    IF v_target.tablename = 'atlas_chat_attachments'
       AND position('atlas_chat_can_access' IN v_policy.qual) = 0
    THEN
      RAISE EXCEPTION 'ATLAS RLS missing attachment participation guard';
    END IF;

    -- Deletion and membership policies must retain their active-member check.
    IF (v_target.tablename = 'atlas_chat_deletion_requests'
        OR v_target.guard_fragment = 'organization_members')
       AND (
         position('organization_members' IN v_policy.qual) = 0
         OR position('om.user_id' IN v_policy.qual) = 0
         OR position('om.status' IN v_policy.qual) = 0
         OR position('active' IN v_policy.qual) = 0
       )
    THEN
      RAISE EXCEPTION 'ATLAS RLS missing active-membership guard in %',
        v_target.tablename;
    END IF;

    v_total := v_total + 1;
  END LOOP;

  IF v_total <> 13 THEN
    RAISE EXCEPTION 'ATLAS RLS expected 13 policies, found %', v_total;
  END IF;

  -- Phase 2: reuse the CURRENT stored predicate, changing only auth.uid().
  -- Wrapping it as an uncorrelated scalar SELECT permits PostgreSQL InitPlan
  -- caching without replacing existing tenant/participant/access predicates.
  FOR v_target IN
    SELECT *
    FROM (VALUES
      ('atlas_chat_retention_policies', 'atlas_chat_retention_read'),
      ('atlas_chat_conversations', 'atlas_chat_conversation_read'),
      ('atlas_chat_participants', 'atlas_chat_participant_read'),
      ('atlas_chat_messages', 'atlas_chat_message_read'),
      ('atlas_chat_message_receipts', 'atlas_chat_receipt_read'),
      ('atlas_chat_message_reactions', 'atlas_chat_reaction_read'),
      ('atlas_chat_deletion_requests', 'atlas_chat_deletion_read'),
      ('atlas_chat_attachments', 'atlas_chat_attachment_read'),
      ('atlas_numbering_authorizations', 'atlas_numbering_authorizations_member_read'),
      ('atlas_number_resources', 'atlas_number_resources_member_read'),
      ('atlas_telephony_providers', 'atlas_telephony_providers_member_read'),
      ('atlas_call_sessions', 'atlas_call_sessions_member_read'),
      ('atlas_call_events', 'atlas_call_events_member_read')
    ) AS targets(tablename, policyname)
  LOOP
    SELECT p.* INTO STRICT v_policy
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename = v_target.tablename
      AND p.policyname = v_target.policyname;

    v_optimized := replace(v_policy.qual, 'auth.uid()', '(select auth.uid())');

    EXECUTE format('ALTER POLICY %I ON public.%I USING (%s)',
      v_target.policyname, v_target.tablename, v_optimized);
  END LOOP;
END;
$atlas_rls_initplan$;
