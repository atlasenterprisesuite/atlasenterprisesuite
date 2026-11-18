-- ATLAS YouTube Direct 777 — atomic worker lease and reconciliation boundary.
-- Backend only. These functions never call YouTube and never infer publication success.

create or replace function public.atlas_youtube_claim_due_job(
  p_org_id uuid,
  p_channel_id text,
  p_worker_id text,
  p_lease_seconds integer default 120
)
returns public.atlas_youtube_publication_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.atlas_youtube_publication_jobs;
begin
  if p_org_id is null or p_channel_id is null or btrim(p_channel_id) = '' then
    raise exception 'youtube_tenant_channel_required' using errcode = '22023';
  end if;
  if p_worker_id is null or btrim(p_worker_id) = '' then
    raise exception 'youtube_worker_id_required' using errcode = '22023';
  end if;
  if p_lease_seconds < 30 or p_lease_seconds > 900 then
    raise exception 'youtube_lease_duration_invalid' using errcode = '22023';
  end if;

  select j.*
    into v_job
  from public.atlas_youtube_publication_jobs j
  join public.atlas_integration_connections c
    on c.id = j.connection_id
   and c.org_id = j.org_id
  join public.atlas_integration_credentials cred
    on cred.id = c.credential_ref
   and cred.org_id = c.org_id
   and cred.provider = c.provider
  join public.atlas_youtube_drafts d
    on d.id = j.draft_id
   and d.org_id = j.org_id
   and d.channel_id = j.channel_id
  join public.atlas_social_scheduled_posts s
    on s.id = j.social_post_id
   and s.org_id = j.org_id
  where j.org_id = p_org_id
    and j.channel_id = p_channel_id
    and j.status = 'queued'
    and j.scheduled_for <= now()
    and j.attempts < j.max_attempts
    and c.provider = 'google'
    and c.state = 'connected'
    and c.authorized = true
    and c.provider_verified = true
    and c.provider_account_id = j.channel_id
    and c.credential_ref is not null
    and 'https://www.googleapis.com/auth/youtube.upload' = any(c.granted_scopes)
    and (cred.expires_at is null or cred.expires_at > now() + make_interval(secs => p_lease_seconds))
    and d.media_status = 'ready'
    and s.platform = 'youtube'
    and s.status in ('scheduled', 'ready')
    and s.scheduled_for = j.scheduled_for
  order by j.scheduled_for asc, j.created_at asc
  for update of j skip locked
  limit 1;

  if not found then
    return null;
  end if;

  update public.atlas_youtube_publication_jobs
  set status = 'leased',
      attempts = attempts + 1,
      lease_owner = p_worker_id,
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      updated_at = now()
  where id = v_job.id
    and org_id = v_job.org_id
    and channel_id = v_job.channel_id
    and status = 'queued'
  returning * into v_job;

  if not found then
    return null;
  end if;

  insert into public.atlas_youtube_publication_events(
    org_id, channel_id, job_id, event_type, correlation_id, detail
  ) values (
    v_job.org_id,
    v_job.channel_id,
    v_job.id,
    'leased',
    gen_random_uuid(),
    jsonb_build_object('worker_id', p_worker_id, 'attempt', v_job.attempts)
  );

  return v_job;
end;
$$;

create or replace function public.atlas_youtube_confirm_published(
  p_org_id uuid,
  p_channel_id text,
  p_job_id uuid,
  p_worker_id text,
  p_provider_video_id text,
  p_correlation_id uuid
)
returns public.atlas_youtube_publication_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.atlas_youtube_publication_jobs;
begin
  if p_org_id is null or p_channel_id is null or btrim(p_channel_id) = '' then
    raise exception 'youtube_tenant_channel_required' using errcode = '22023';
  end if;
  if p_worker_id is null or btrim(p_worker_id) = '' then
    raise exception 'youtube_worker_id_required' using errcode = '22023';
  end if;
  if p_provider_video_id is null or btrim(p_provider_video_id) = '' then
    raise exception 'youtube_provider_video_id_required' using errcode = '22023';
  end if;
  if p_correlation_id is null then
    raise exception 'youtube_correlation_id_required' using errcode = '22023';
  end if;

  update public.atlas_youtube_publication_jobs
  set status = 'published',
      provider_video_id = btrim(p_provider_video_id),
      lease_owner = null,
      lease_expires_at = null,
      updated_at = now()
  where id = p_job_id
    and org_id = p_org_id
    and channel_id = p_channel_id
    and status = 'leased'
    and lease_owner = p_worker_id
  returning * into v_job;

  if not found then
    raise exception 'youtube_publish_confirmation_rejected' using errcode = '42501';
  end if;

  insert into public.atlas_youtube_publication_events(
    org_id, channel_id, job_id, event_type, correlation_id, detail
  ) values (
    v_job.org_id,
    v_job.channel_id,
    v_job.id,
    'provider_publish_confirmed',
    p_correlation_id,
    jsonb_build_object('provider_video_id', v_job.provider_video_id)
  );

  return v_job;
end;
$$;

create or replace function public.atlas_youtube_requeue_after_confirmed_absence(
  p_org_id uuid,
  p_channel_id text,
  p_job_id uuid,
  p_worker_id text,
  p_provider_confirmed_absent boolean,
  p_correlation_id uuid
)
returns public.atlas_youtube_publication_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job public.atlas_youtube_publication_jobs;
begin
  if p_org_id is null or p_channel_id is null or btrim(p_channel_id) = '' then
    raise exception 'youtube_tenant_channel_required' using errcode = '22023';
  end if;
  if p_provider_confirmed_absent is distinct from true then
    raise exception 'youtube_provider_absence_not_confirmed' using errcode = '42501';
  end if;
  if p_worker_id is null or btrim(p_worker_id) = '' or p_correlation_id is null then
    raise exception 'youtube_reconciliation_identity_required' using errcode = '22023';
  end if;

  update public.atlas_youtube_publication_jobs
  set status = 'queued',
      lease_owner = null,
      lease_expires_at = null,
      updated_at = now()
  where id = p_job_id
    and org_id = p_org_id
    and channel_id = p_channel_id
    and status = 'leased'
    and lease_owner = p_worker_id
    and attempts < max_attempts
  returning * into v_job;

  if not found then
    raise exception 'youtube_requeue_rejected' using errcode = '42501';
  end if;

  insert into public.atlas_youtube_publication_events(
    org_id, channel_id, job_id, event_type, correlation_id, detail
  ) values (
    v_job.org_id,
    v_job.channel_id,
    v_job.id,
    'provider_absence_confirmed_requeued',
    p_correlation_id,
    '{}'::jsonb
  );

  return v_job;
end;
$$;

create or replace function public.atlas_youtube_quarantine_expired_leases()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
begin
  with quarantined as (
    update public.atlas_youtube_publication_jobs
    set status = 'blocked',
        lease_owner = null,
        lease_expires_at = null,
        updated_at = now()
    where status = 'leased'
      and lease_expires_at <= now()
    returning org_id, channel_id, id, attempts
  ),
  logged as (
    insert into public.atlas_youtube_publication_events(
      org_id, channel_id, job_id, event_type, correlation_id, detail
    )
    select
      org_id,
      channel_id,
      id,
      'lease_expired_blocked',
      gen_random_uuid(),
      jsonb_build_object('attempt', attempts, 'requires_reconciliation', true)
    from quarantined
    returning 1
  )
  select count(*) into v_count from logged;

  return v_count;
end;
$$;

revoke all on function public.atlas_youtube_claim_due_job(uuid, text, text, integer)
  from public, anon, authenticated;
revoke all on function public.atlas_youtube_confirm_published(uuid, text, uuid, text, text, uuid)
  from public, anon, authenticated;
revoke all on function public.atlas_youtube_requeue_after_confirmed_absence(uuid, text, uuid, text, boolean, uuid)
  from public, anon, authenticated;
revoke all on function public.atlas_youtube_quarantine_expired_leases()
  from public, anon, authenticated;

grant execute on function public.atlas_youtube_claim_due_job(uuid, text, text, integer) to service_role;
grant execute on function public.atlas_youtube_confirm_published(uuid, text, uuid, text, text, uuid) to service_role;
grant execute on function public.atlas_youtube_requeue_after_confirmed_absence(uuid, text, uuid, text, boolean, uuid) to service_role;
grant execute on function public.atlas_youtube_quarantine_expired_leases() to service_role;
