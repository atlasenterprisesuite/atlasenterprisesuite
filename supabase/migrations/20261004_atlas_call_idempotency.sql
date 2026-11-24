alter table public.atlas_call_sessions
  add column if not exists idempotency_key text,
  add column if not exists request_digest text,
  add column if not exists reconciliation_required boolean not null default false,
  add column if not exists reconciliation_reason text;

create unique index if not exists atlas_call_sessions_org_idempotency_uidx
  on public.atlas_call_sessions (organization_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists atlas_call_sessions_org_reconciliation_idx
  on public.atlas_call_sessions (organization_id, reconciliation_required, updated_at desc)
  where reconciliation_required = true;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'atlas_call_sessions_idempotency_key_length_check'
  ) then
    alter table public.atlas_call_sessions
      add constraint atlas_call_sessions_idempotency_key_length_check
      check (idempotency_key is null or length(trim(idempotency_key)) between 8 and 160);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'atlas_call_sessions_request_digest_check'
  ) then
    alter table public.atlas_call_sessions
      add constraint atlas_call_sessions_request_digest_check
      check (request_digest is null or request_digest ~ '^[a-f0-9]{64}$');
  end if;
end $$;

comment on column public.atlas_call_sessions.idempotency_key is
  'Stable client logical-mutation key scoped by organization. Replays never mint a new key automatically.';
comment on column public.atlas_call_sessions.request_digest is
  'SHA-256 digest of normalized call mutation input used to reject changed-payload replays.';
comment on column public.atlas_call_sessions.reconciliation_required is
  'True when provider outcome is ambiguous and ATLAS must reconcile before any retry or final truth claim.';
