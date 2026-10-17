alter table public.atlas_certificate_observations
  add constraint atlas_certificate_evidence_run_unique
  unique (org_id,target_id,evidence_ref);
alter table public.atlas_certificate_observations
  add constraint atlas_certificate_validity_order
  check (not_before is null or not_after is null or not_before < not_after);

create or replace function atlas_private.reject_certificate_observation_rewrite()
returns trigger language plpgsql set search_path = ''
as $$
begin
  raise exception 'certificate_observation_append_only';
end;
$$;
revoke all on function atlas_private.reject_certificate_observation_rewrite() from public,anon,authenticated;
create trigger reject_certificate_observation_rewrite
before update or delete on public.atlas_certificate_observations
for each row execute function atlas_private.reject_certificate_observation_rewrite();
