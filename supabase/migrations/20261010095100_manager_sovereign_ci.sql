alter table public.execution_evidence
  add column if not exists metadata jsonb not null default '{}'::jsonb;

comment on column public.execution_evidence.metadata is
  'Bounded non-secret execution evidence metadata. Never store credentials, tokens, private keys, or unredacted command output.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'execution_evidence_metadata_object'
      and conrelid = 'public.execution_evidence'::regclass
  ) then
    alter table public.execution_evidence
      add constraint execution_evidence_metadata_object
      check (jsonb_typeof(metadata) = 'object');
  end if;
end
$$;
