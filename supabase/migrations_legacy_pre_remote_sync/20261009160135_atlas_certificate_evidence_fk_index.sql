-- Cover the (target_id, org_id) foreign-key leading order used by tenant certificate evidence.
create index if not exists atlas_cert_observations_target_org_fk_idx
  on public.atlas_certificate_observations (target_id, org_id);
