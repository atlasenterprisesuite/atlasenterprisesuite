-- Harden payroll capability readiness against RLS bypass and incomplete provider verification.

alter table public.payroll_provider_connections
  drop constraint if exists payroll_provider_verified_evidence_check;

alter table public.payroll_provider_connections
  add constraint payroll_provider_verified_evidence_check check (
    status <> 'verified' or (
      last_verified_at is not null and
      nullif(btrim(verification_evidence_hash),'') is not null and
      nullif(btrim(credentials_ref),'') is not null and
      cardinality(capabilities) > 0
    )
  );

alter function public.payroll_get_capability_readiness(uuid) security invoker;
