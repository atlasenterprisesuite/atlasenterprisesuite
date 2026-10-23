-- Optimize RLS auth initialization plans without changing authorization semantics.
-- Supabase advisor: auth_rls_initplan.
-- Applied to production project ggmanzcgtlrvqfoccgsh and rechecked: advisor count = 0.

alter policy advisory_memberships_read on public.advisory_firm_memberships
  using ((user_id = (select auth.uid())) or (has_identity_permission(org_id, 'advisory.manage'::text) and is_advisory_firm_member(org_id, firm_id)));

alter policy atlas_local_network_endpoints_insert on public.atlas_local_network_endpoints
  with check ((created_by = (select auth.uid())) and (updated_by = (select auth.uid())) and has_identity_permission(org_id, 'device.local.admin'::text));

alter policy atlas_local_network_events_insert on public.atlas_local_network_events
  with check ((actor_user_id = (select auth.uid())) and (has_identity_permission(org_id, 'device.local.use'::text) or has_identity_permission(org_id, 'device.local.admin'::text)));

alter policy atlas_memory_org_read on public.atlas_memory_records
  using (exists (
    select 1 from public.organization_members om
    where om.org_id = atlas_memory_records.organization_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'::text
      and (atlas_memory_records.sensitivity = 'organization'::text or om.role = any (array['owner'::text,'admin'::text,'platform_admin'::text]))
  ));

alter policy atlas_oauth_states_insert_authorized on public.atlas_oauth_states
  with check ((user_id = (select auth.uid())) and (has_identity_permission(org_id, 'integrations.admin'::text) or has_identity_permission(org_id, 'integrations.manage'::text)));

alter policy atlas_social_inbox_insert on public.atlas_social_inbox_threads
  with check ((created_by = (select auth.uid())) and is_org_member(org_id) and (has_identity_permission(org_id, 'social.write'::text) or has_identity_permission(org_id, 'social.manage'::text)));

alter policy atlas_social_schedule_insert on public.atlas_social_scheduled_posts
  with check ((created_by = (select auth.uid())) and is_org_member(org_id) and (has_identity_permission(org_id, 'social.write'::text) or has_identity_permission(org_id, 'social.manage'::text)));

alter policy compliance_audit_subject_or_reviewer_read on public.compliance_audit_events
  using (exists (
    select 1 from public.organization_members om
    where om.org_id = compliance_audit_events.organization_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'::text
      and (compliance_audit_events.subject_user_id = (select auth.uid()) or om.role = any (array['owner'::text,'admin'::text,'platform_admin'::text]))
  ));

alter policy compliance_requirements_subject_or_reviewer_read on public.compliance_requirements
  using (exists (
    select 1 from public.organization_members om
    where om.org_id = compliance_requirements.organization_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'::text
      and (compliance_requirements.subject_user_id = (select auth.uid()) or om.role = any (array['owner'::text,'admin'::text,'platform_admin'::text]))
  ));

alter policy compliance_submissions_subject_insert on public.compliance_submissions
  with check (
    submitted_by = (select auth.uid())
    and subject_user_id = (select auth.uid())
    and tenant_id = organization_id
    and status = 'uploading'::text
    and storage_bucket = 'atlas-compliance-evidence'::text
    and storage_path like 'pending/%'::text
    and exists (
      select 1 from public.organization_members om
      where om.org_id = compliance_submissions.organization_id
        and om.user_id = (select auth.uid())
        and om.status = 'active'::text
    )
    and exists (
      select 1 from public.compliance_requirements cr
      where cr.id = compliance_submissions.requirement_id
        and cr.organization_id = compliance_submissions.organization_id
        and cr.tenant_id = compliance_submissions.tenant_id
        and cr.subject_user_id = (select auth.uid())
        and cr.module = 'ride'::text
        and cr.requirement_type = 'profile_photo'::text
        and cr.status = any (array['action_required'::text,'rejected'::text])
    )
  );

alter policy compliance_submissions_subject_or_reviewer_read on public.compliance_submissions
  using (exists (
    select 1 from public.organization_members om
    where om.org_id = compliance_submissions.organization_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'::text
      and (compliance_submissions.subject_user_id = (select auth.uid()) or om.role = any (array['owner'::text,'admin'::text,'platform_admin'::text]))
  ));

alter policy creator_creative_plans_member_read on public.creator_creative_plans
  using (exists (
    select 1 from public.organization_members om
    where om.org_id = creator_creative_plans.organization_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'::text
  ));

alter policy creator_recordings_org_read on public.creator_recordings
  using (exists (
    select 1 from public.organization_members om
    where om.org_id = creator_recordings.organization_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'::text
  ));

alter policy insurance_verification_audit_member_read on public.insurance_verification_audit
  using ((user_id = (select auth.uid())) and exists (
    select 1 from public.organization_members om
    where om.org_id = insurance_verification_audit.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'::text
  ));

alter policy insurance_verification_challenges_member_read on public.insurance_verification_challenges
  using ((user_id = (select auth.uid())) and exists (
    select 1 from public.organization_members om
    where om.org_id = insurance_verification_challenges.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'::text
  ));

alter policy insurance_verification_grants_member_read on public.insurance_verification_grants
  using ((user_id = (select auth.uid())) and exists (
    select 1 from public.organization_members om
    where om.org_id = insurance_verification_grants.org_id
      and om.user_id = (select auth.uid())
      and om.status = 'active'::text
  ));
