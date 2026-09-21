-- ATLAS Vendor W-9 intake, address normalization and 1099 readiness.
-- A W-9 is onboarding evidence. It does not itself create a filed 1099.
-- This schema persists normalized vendor tax facts, keeps the full TIN encrypted in Supabase Vault, and exposes only the last four digits to ordinary application reads.

create table if not exists public.purchasing_vendor_addresses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  vendor_id uuid not null references public.purchasing_vendors(id) on delete cascade,
  address_type text not null default 'business',
  address_line1 text not null,
  address_line2 text,
  city text not null,
  state text not null,
  postal_code text not null,
  country_code text not null default 'US',
  source text not null default 'w9',
  reviewed_at timestamptz,
  reviewed_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, vendor_id, address_type),
  constraint purchasing_vendor_addresses_type_check check (address_type in ('business','remit_to','mailing')),
  constraint purchasing_vendor_addresses_country_check check (country_code ~ '^[A-Z]{2}$')
);

create table if not exists public.purchasing_vendor_tax_profiles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  vendor_id uuid not null references public.purchasing_vendors(id) on delete cascade,
  legal_name text not null,
  business_name text,
  federal_tax_classification text not null,
  llc_tax_classification text,
  tax_id_type text not null default 'unknown',
  tax_id_vault_secret_id uuid,
  tax_id_last4 text,
  w9_status text not null default 'reviewed',
  w9_signed_date date,
  w9_source_filename text,
  reportability_status text not null default 'review_required',
  default_1099_form text,
  reviewed_at timestamptz not null default now(),
  reviewed_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, vendor_id),
  constraint vendor_tax_classification_check check (
    federal_tax_classification in (
      'individual_sole_proprietor','c_corporation','s_corporation',
      'partnership','trust_estate','llc','other'
    )
  ),
  constraint vendor_llc_tax_classification_check check (
    llc_tax_classification is null or llc_tax_classification in ('C','S','P')
  ),
  constraint vendor_tax_id_type_check check (tax_id_type in ('ein','ssn','unknown')),
  constraint vendor_tax_id_last4_check check (tax_id_last4 is null or tax_id_last4 ~ '^\\d{4}$'),
  constraint vendor_w9_status_check check (w9_status in ('review_required','reviewed','superseded')),
  constraint vendor_reportability_status_check check (reportability_status in ('review_required','reportable','not_reportable')),
  constraint vendor_default_1099_form_check check (default_1099_form is null or default_1099_form in ('1099-NEC','1099-MISC'))
);

create table if not exists public.purchasing_vendor_tax_audit_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  vendor_id uuid not null references public.purchasing_vendors(id) on delete cascade,
  action text not null,
  tax_classification text,
  tax_id_type text,
  tax_id_last4 text,
  actor_user_id uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists purchasing_vendor_addresses_vendor_idx
  on public.purchasing_vendor_addresses (org_id, vendor_id);
create index if not exists purchasing_vendor_tax_profiles_vendor_idx
  on public.purchasing_vendor_tax_profiles (org_id, vendor_id);
create index if not exists purchasing_vendor_tax_audit_vendor_idx
  on public.purchasing_vendor_tax_audit_events (org_id, vendor_id, created_at desc);

alter table public.purchasing_vendor_addresses enable row level security;
alter table public.purchasing_vendor_tax_profiles enable row level security;
alter table public.purchasing_vendor_tax_audit_events enable row level security;

drop policy if exists purchasing_vendor_addresses_read on public.purchasing_vendor_addresses;
create policy purchasing_vendor_addresses_read on public.purchasing_vendor_addresses
  for select to authenticated using (public.is_org_member(org_id));

drop policy if exists purchasing_vendor_tax_profiles_read on public.purchasing_vendor_tax_profiles;
create policy purchasing_vendor_tax_profiles_read on public.purchasing_vendor_tax_profiles
  for select to authenticated using (public.is_org_member(org_id));

drop policy if exists purchasing_vendor_tax_audit_read on public.purchasing_vendor_tax_audit_events;
create policy purchasing_vendor_tax_audit_read on public.purchasing_vendor_tax_audit_events
  for select to authenticated using (public.is_org_member(org_id));

revoke insert, update, delete on public.purchasing_vendor_addresses from authenticated;
revoke insert, update, delete on public.purchasing_vendor_tax_profiles from authenticated;
revoke insert, update, delete on public.purchasing_vendor_tax_audit_events from authenticated;

grant select on public.purchasing_vendor_addresses to authenticated;
grant select on public.purchasing_vendor_tax_profiles to authenticated;
grant select on public.purchasing_vendor_tax_audit_events to authenticated;

create or replace function public.upsert_vendor_w9_profile_v1(
  p_org_id uuid,
  p_vendor_id uuid,
  p_legal_name text,
  p_business_name text,
  p_federal_tax_classification text,
  p_llc_tax_classification text,
  p_address_line1 text,
  p_address_line2 text,
  p_city text,
  p_state text,
  p_postal_code text,
  p_tax_id_type text default 'unknown',
  p_tax_id text default null,
  p_w9_signed_date date default null,
  p_w9_source_filename text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $
declare
  v_profile_id uuid;
  v_address_id uuid;
  v_tin_digits text;
  v_tin_last4 text;
  v_secret_id uuid;
  v_secret_name text;
begin
  if auth.uid() is null then raise exception 'authentication_required'; end if;
  if not public.can_write_purchasing_data(p_org_id) then raise exception 'purchasing_permission_denied'; end if;

  if not exists (
    select 1 from public.purchasing_vendors
    where id = p_vendor_id and org_id = p_org_id
  ) then
    raise exception 'vendor_not_found';
  end if;

  if coalesce(trim(p_legal_name),'') = '' then raise exception 'w9_legal_name_required'; end if;
  if coalesce(trim(p_address_line1),'') = '' then raise exception 'w9_business_address_required'; end if;
  if coalesce(trim(p_city),'') = '' or coalesce(trim(p_state),'') = '' or coalesce(trim(p_postal_code),'') = '' then
    raise exception 'w9_city_state_zip_required';
  end if;
  if p_federal_tax_classification not in (
    'individual_sole_proprietor','c_corporation','s_corporation',
    'partnership','trust_estate','llc','other'
  ) then
    raise exception 'w9_tax_classification_required';
  end if;
  if p_federal_tax_classification = 'llc' and coalesce(p_llc_tax_classification,'') not in ('C','S','P') then
    raise exception 'w9_llc_tax_classification_required';
  end if;
  if p_tax_id_type not in ('ein','ssn') then raise exception 'w9_tax_id_type_required'; end if;
  v_tin_digits := regexp_replace(coalesce(p_tax_id,''), '[^0-9]', '', 'g');
  if length(v_tin_digits) <> 9 then raise exception 'w9_tax_id_invalid'; end if;
  v_tin_last4 := right(v_tin_digits,4);
  v_secret_name := 'atlas.vendor.tin.' || p_org_id::text || '.' || p_vendor_id::text;

  select id into v_secret_id
  from vault.secrets
  where name = v_secret_name
  order by updated_at desc
  limit 1;

  if v_secret_id is null then
    perform vault.create_secret(
      v_tin_digits,
      v_secret_name,
      'ATLAS vendor taxpayer identification number; encrypted at rest'
    );
    select id into v_secret_id
    from vault.secrets
    where name = v_secret_name
    order by updated_at desc
    limit 1;
  else
    perform vault.update_secret(
      v_secret_id,
      v_tin_digits,
      v_secret_name,
      'ATLAS vendor taxpayer identification number; encrypted at rest'
    );
  end if;

  if v_secret_id is null then raise exception 'w9_tax_id_vault_write_failed'; end if;

  insert into public.purchasing_vendor_addresses (
    org_id,vendor_id,address_type,address_line1,address_line2,city,state,postal_code,
    country_code,source,reviewed_at,reviewed_by,updated_at
  ) values (
    p_org_id,p_vendor_id,'business',trim(p_address_line1),nullif(trim(p_address_line2),''),
    trim(p_city),upper(trim(p_state)),trim(p_postal_code),'US','w9',now(),auth.uid(),now()
  )
  on conflict (org_id,vendor_id,address_type) do update set
    address_line1=excluded.address_line1,
    address_line2=excluded.address_line2,
    city=excluded.city,
    state=excluded.state,
    postal_code=excluded.postal_code,
    country_code=excluded.country_code,
    source='w9',
    reviewed_at=now(),
    reviewed_by=auth.uid(),
    updated_at=now()
  returning id into v_address_id;

  insert into public.purchasing_vendor_tax_profiles (
    org_id,vendor_id,legal_name,business_name,federal_tax_classification,llc_tax_classification,
    tax_id_type,tax_id_vault_secret_id,tax_id_last4,w9_status,w9_signed_date,w9_source_filename,
    reportability_status,default_1099_form,reviewed_at,reviewed_by,updated_at
  ) values (
    p_org_id,p_vendor_id,trim(p_legal_name),nullif(trim(p_business_name),''),
    p_federal_tax_classification,
    case when p_federal_tax_classification='llc' then p_llc_tax_classification else null end,
    p_tax_id_type,v_secret_id,v_tin_last4,'reviewed',p_w9_signed_date,nullif(trim(p_w9_source_filename),''),
    'review_required',null,now(),auth.uid(),now()
  )
  on conflict (org_id,vendor_id) do update set
    legal_name=excluded.legal_name,
    business_name=excluded.business_name,
    federal_tax_classification=excluded.federal_tax_classification,
    llc_tax_classification=excluded.llc_tax_classification,
    tax_id_type=excluded.tax_id_type,
    tax_id_vault_secret_id=excluded.tax_id_vault_secret_id,
    tax_id_last4=excluded.tax_id_last4,
    w9_status='reviewed',
    w9_signed_date=excluded.w9_signed_date,
    w9_source_filename=excluded.w9_source_filename,
    reportability_status='review_required',
    default_1099_form=null,
    reviewed_at=now(),
    reviewed_by=auth.uid(),
    updated_at=now()
  returning id into v_profile_id;

  insert into public.purchasing_vendor_tax_audit_events (
    org_id,vendor_id,action,tax_classification,tax_id_type,tax_id_last4,actor_user_id
  ) values (
    p_org_id,p_vendor_id,'w9_reviewed',p_federal_tax_classification,p_tax_id_type,v_tin_last4,auth.uid()
  );

  return jsonb_build_object(
    'vendor_id',p_vendor_id,
    'tax_profile_id',v_profile_id,
    'business_address_id',v_address_id,
    'w9_status','reviewed',
    'reportability_status','review_required'
  );
end;
$$;

revoke all on function public.upsert_vendor_w9_profile_v1(
  uuid,uuid,text,text,text,text,text,text,text,text,text,text,text,date,text
) from public, anon;
grant execute on function public.upsert_vendor_w9_profile_v1(
  uuid,uuid,text,text,text,text,text,text,text,text,text,text,text,date,text
) to authenticated;
