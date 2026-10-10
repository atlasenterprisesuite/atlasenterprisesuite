create index if not exists idx_atlas_approvals_decided_by on public.atlas_approvals(decided_by) where decided_by is not null;
