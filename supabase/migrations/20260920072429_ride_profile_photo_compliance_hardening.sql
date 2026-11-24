-- Harden the direct authenticated submission path. The web product uses the
-- atlas-ride-compliance Edge Function, but RLS must still fail closed if a
-- caller reaches PostgREST directly.

drop policy if exists compliance_submissions_subject_insert on public.compliance_submissions;
create policy compliance_submissions_subject_insert
on public.compliance_submissions
for insert
to authenticated
with check (
  submitted_by = auth.uid()
  and subject_user_id = auth.uid()
  and tenant_id = organization_id
  and status = 'uploading'
  and storage_bucket = 'atlas-compliance-evidence'
  and storage_path like 'pending/%'
  and exists (
    select 1
    from public.organization_members om
    where om.org_id = compliance_submissions.organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  )
  and exists (
    select 1
    from public.compliance_requirements cr
    where cr.id = compliance_submissions.requirement_id
      and cr.organization_id = compliance_submissions.organization_id
      and cr.tenant_id = compliance_submissions.tenant_id
      and cr.subject_user_id = auth.uid()
      and cr.module = 'ride'
      and cr.requirement_type = 'profile_photo'
      and cr.status in ('action_required','rejected')
  )
);

comment on policy compliance_submissions_subject_insert on public.compliance_submissions is
  'Fail-closed direct insert: only an authenticated subject, active in the organization, may create an uploading placeholder for their actionable Ride profile-photo requirement.';
