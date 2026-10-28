alter table public.hospitality_provider_instances
  drop constraint if exists hospitality_provider_instances_provider_type_check;

alter table public.hospitality_provider_instances
  add constraint hospitality_provider_instances_provider_type_check
  check (provider_type in (
    'salto_ks',
    'salto_space_hospitality',
    'vingcard_vconnect',
    'vingcard_vostio',
    'vingcard_visionline',
    'dormakaba_ambiance_cloud',
    'dormakaba_ambiance_soap',
    'dormakaba_ambiance_rest',
    'dormakaba_pms_bridge',
    'onity',
    'generic_certified'
  ));

comment on constraint hospitality_provider_instances_provider_type_check
  on public.hospitality_provider_instances is
  'ATLAS Hospitality provider allowlist. Onity remains fail-closed until an official provider interface is configured and verified.';
