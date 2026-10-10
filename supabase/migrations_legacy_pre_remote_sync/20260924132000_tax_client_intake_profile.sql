-- ATLAS Tax client intake profile and household.
-- Sensitive taxpayer identifiers are never stored raw in ordinary relational tables.
-- Only last4 + a future secure-vault reference are persisted until a dedicated secret-vault adapter is verified.

create table if not exists public.tax_client_profiles (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  firm_id uuid not null references public.advisory_firms(id) on delete restrict,
  client_id uuid not null references public.advisory_clients(id) on delete cascade,
  first_name text not null check (length(trim(first_name)) between 1 and 120),
  middle_name text,
  last_name text not null check (length(trim(last_name)) between 1 and 120),
  suffix text,
  preferred_name text,
  mpc_number text,
  date_of_birth date not null,
  occupation text,
  marital_status text not null default 'unknown'
    check (marital_status in ('single','married','divorced','widowed','separated','unknown')),
  filing_status text not null default 'undetermined'
    check (filing_status in (
      'single','married_filing_jointly','married_filing_separately',
      'head_of_household','qualifying_surviving_spouse','undetermined'
    )),
  residency_status text not null default 'unknown'
    check (residency_status in ('us_citizen','resident_alien','nonresident_alien','dual_status','unknown')),
  taxpayer_id_type text not null default 'ssn'
    check (taxpayer_id_type in ('ssn','itin','other','none')),
  taxpayer_id_last4 text check (taxpayer_id_last4 is null or taxpayer_id_last4 ~ '^[0-9]{4}$'),
  taxpayer_id_secret_reference text,
  ip_pin_required boolean not null default false,
  ip_pin_secret_reference text,
  email text,
  phone text,
  address_line1 text,
  address_line2 text,
  city text,
  state_region text,
  postal_code text,
  country_code text not null default 'US' check (length(trim(country_code)) between 2 and 3),
  county text,
  prior_year_filed boolean,
  prior_year_filing_status text,
  identity_verified boolean not null default false,
  intake_status text not null default 'draft'
    check (intake_status in ('draft','needs_information','ready_for_return','reviewed')),
  notes text,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, client_id)
);

create table if not exists public.tax_client_household_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  firm_id uuid not null references public.advisory_firms(id) on delete restrict,
  client_id uuid not null references public.advisory_clients(id) on delete cascade,
  relationship text not null check (relationship in (
    'spouse','son','daughter','stepchild','foster_child','sibling','parent',
    'grandchild','other_relative','other'
  )),
  first_name text not null check (length(trim(first_name)) between 1 and 120),
  middle_name text,
  last_name text not null check (length(trim(last_name)) between 1 and 120),
  date_of_birth date,
  taxpayer_id_type text not null default 'ssn'
    check (taxpayer_id_type in ('ssn','itin','atin','other','none')),
  taxpayer_id_last4 text check (taxpayer_id_last4 is null or taxpayer_id_last4 ~ '^[0-9]{4}$'),
  taxpayer_id_secret_reference text,
  months_lived_with_taxpayer integer check (months_lived_with_taxpayer between 0 and 12),
  full_time_student boolean not null default false,
  permanently_disabled boolean not null default false,
  gross_income numeric check (gross_income is null or gross_income >= 0),
  taxpayer_provided_support_percent numeric check (
    taxpayer_provided_support_percent is null or
    taxpayer_provided_support_percent between 0 and 100
  ),
  childcare_expenses numeric check (childcare_expenses is null or childcare_expenses >= 0),
  qualifying_child_candidate boolean not null default false,
  qualifying_relative_candidate boolean not null default false,
  dependent_claim_review text not null default 'unreviewed'
    check (dependent_claim_review in ('unreviewed','review','approved','rejected')),
  notes text,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tax_client_profiles_org_idx
  on public.tax_client_profiles(org_id, firm_id, intake_status, last_name, first_name);
create index if not exists tax_client_household_client_idx
  on public.tax_client_household_members(org_id, client_id, relationship, last_name);

alter table public.tax_client_profiles enable row level security;
alter table public.tax_client_household_members enable row level security;

drop policy if exists tax_client_profiles_read on public.tax_client_profiles;
create policy tax_client_profiles_read on public.tax_client_profiles for select to authenticated
using (public.has_identity_permission(org_id, 'tax.read'));

drop policy if exists tax_client_household_read on public.tax_client_household_members;
create policy tax_client_household_read on public.tax_client_household_members for select to authenticated
using (public.has_identity_permission(org_id, 'tax.read'));

revoke all on public.tax_client_profiles from anon, authenticated;
revoke all on public.tax_client_household_members from anon, authenticated;
grant select on public.tax_client_profiles, public.tax_client_household_members to authenticated;
grant all on public.tax_client_profiles, public.tax_client_household_members to service_role;

create or replace function public.tax_upsert_client_intake(
  p_firm_id uuid,
  p_client_id uuid default null,
  p_profile jsonb default '{}'::jsonb,
  p_household jsonb default '[]'::jsonb
)
returns setof public.tax_client_profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_org uuid := public.tax_actor_org();
  v_client uuid := p_client_id;
  v_profile_id uuid;
  v_first text := trim(coalesce(p_profile->>'first_name',''));
  v_middle text := nullif(trim(coalesce(p_profile->>'middle_name','')),'');
  v_last text := trim(coalesce(p_profile->>'last_name',''));
  v_suffix text := nullif(trim(coalesce(p_profile->>'suffix','')),'');
  v_display_name text;
  v_email text := nullif(trim(coalesce(p_profile->>'email','')),'');
  v_phone text := nullif(trim(coalesce(p_profile->>'phone','')),'');
  v_filing_status text := coalesce(nullif(trim(p_profile->>'filing_status'),''),'undetermined');
  v_marital_status text := coalesce(nullif(trim(p_profile->>'marital_status'),''),'unknown');
  v_residency_status text := coalesce(nullif(trim(p_profile->>'residency_status'),''),'unknown');
  v_taxpayer_id_type text := coalesce(nullif(trim(p_profile->>'taxpayer_id_type'),''),'ssn');
  v_taxpayer_last4 text := nullif(regexp_replace(coalesce(p_profile->>'taxpayer_id_last4',''), '[^0-9]', '', 'g'),'');
  v_dob date;
  v_member jsonb;
  v_member_last4 text;
begin
  if v_user is null or v_org is null then
    raise exception 'Authentication and active organization required';
  end if;
  if not public.has_identity_permission(v_org, 'tax.prepare') then
    raise exception 'Tax prepare permission required';
  end if;
  if not exists (
    select 1 from public.advisory_firms f
    where f.id = p_firm_id and f.org_id = v_org and f.status = 'active'
  ) then
    raise exception 'Firm not available in active organization';
  end if;

  if jsonb_typeof(coalesce(p_profile,'{}'::jsonb)) <> 'object' then
    raise exception 'Client profile must be an object';
  end if;
  if jsonb_typeof(coalesce(p_household,'[]'::jsonb)) <> 'array' then
    raise exception 'Household must be an array';
  end if;

  if p_profile ? 'ssn' or p_profile ? 'social_security_number' or p_profile ? 'taxpayer_id_full' then
    raise exception 'Raw taxpayer identifiers are prohibited; provide last4 and secure secret reference only';
  end if;

  if length(v_first) = 0 or length(v_last) = 0 then
    raise exception 'First and last name are required';
  end if;
  begin
    v_dob := (p_profile->>'date_of_birth')::date;
  exception when others then
    raise exception 'Valid date of birth is required';
  end;
  if v_dob > current_date then raise exception 'Date of birth cannot be in the future'; end if;

  if v_filing_status not in (
    'single','married_filing_jointly','married_filing_separately',
    'head_of_household','qualifying_surviving_spouse','undetermined'
  ) then raise exception 'Invalid filing status'; end if;
  if v_marital_status not in ('single','married','divorced','widowed','separated','unknown') then
    raise exception 'Invalid marital status';
  end if;
  if v_residency_status not in ('us_citizen','resident_alien','nonresident_alien','dual_status','unknown') then
    raise exception 'Invalid residency status';
  end if;
  if v_taxpayer_id_type not in ('ssn','itin','other','none') then raise exception 'Invalid taxpayer id type'; end if;
  if v_taxpayer_last4 is not null and length(v_taxpayer_last4) <> 4 then raise exception 'Taxpayer identifier last4 must contain four digits'; end if;

  v_display_name := concat_ws(' ', v_first, v_middle, v_last, v_suffix);

  if v_client is null then
    insert into public.advisory_clients(
      org_id, firm_id, display_name, client_type, email, phone, status, owner_id, created_by
    ) values (
      v_org, p_firm_id, v_display_name, 'person', v_email, v_phone, 'active', v_user, v_user
    ) returning id into v_client;
  else
    if not exists (
      select 1 from public.advisory_clients c
      where c.id = v_client and c.org_id = v_org and c.firm_id = p_firm_id and c.status <> 'inactive'
    ) then raise exception 'Client not available in firm'; end if;

    update public.advisory_clients
    set display_name = v_display_name,
        client_type = 'person',
        email = v_email,
        phone = v_phone,
        updated_at = now()
    where id = v_client and org_id = v_org;
  end if;

  insert into public.tax_client_profiles(
    org_id, firm_id, client_id,
    first_name, middle_name, last_name, suffix, preferred_name, mpc_number, date_of_birth,
    occupation, marital_status, filing_status, residency_status,
    taxpayer_id_type, taxpayer_id_last4, taxpayer_id_secret_reference,
    ip_pin_required, ip_pin_secret_reference,
    email, phone, address_line1, address_line2, city, state_region, postal_code, country_code, county,
    prior_year_filed, prior_year_filing_status, identity_verified, intake_status, notes,
    created_by, updated_by
  ) values (
    v_org, p_firm_id, v_client,
    v_first, v_middle, v_last, v_suffix,
    nullif(trim(coalesce(p_profile->>'preferred_name','')),''),
    nullif(trim(coalesce(p_profile->>'mpc_number','')),''),
    v_dob,
    nullif(trim(coalesce(p_profile->>'occupation','')),''),
    v_marital_status, v_filing_status, v_residency_status,
    v_taxpayer_id_type, v_taxpayer_last4,
    nullif(trim(coalesce(p_profile->>'taxpayer_id_secret_reference','')),''),
    coalesce((p_profile->>'ip_pin_required')::boolean,false),
    nullif(trim(coalesce(p_profile->>'ip_pin_secret_reference','')),''),
    v_email, v_phone,
    nullif(trim(coalesce(p_profile->>'address_line1','')),''),
    nullif(trim(coalesce(p_profile->>'address_line2','')),''),
    nullif(trim(coalesce(p_profile->>'city','')),''),
    nullif(trim(coalesce(p_profile->>'state_region','')),''),
    nullif(trim(coalesce(p_profile->>'postal_code','')),''),
    upper(coalesce(nullif(trim(p_profile->>'country_code'),''),'US')),
    nullif(trim(coalesce(p_profile->>'county','')),''),
    case when p_profile ? 'prior_year_filed' then (p_profile->>'prior_year_filed')::boolean else null end,
    nullif(trim(coalesce(p_profile->>'prior_year_filing_status','')),''),
    coalesce((p_profile->>'identity_verified')::boolean,false),
    coalesce(nullif(trim(p_profile->>'intake_status'),''),'draft'),
    nullif(trim(coalesce(p_profile->>'notes','')),''),
    v_user, v_user
  )
  on conflict (org_id, client_id) do update set
    first_name = excluded.first_name,
    middle_name = excluded.middle_name,
    last_name = excluded.last_name,
    suffix = excluded.suffix,
    preferred_name = excluded.preferred_name,
    mpc_number = excluded.mpc_number,
    date_of_birth = excluded.date_of_birth,
    occupation = excluded.occupation,
    marital_status = excluded.marital_status,
    filing_status = excluded.filing_status,
    residency_status = excluded.residency_status,
    taxpayer_id_type = excluded.taxpayer_id_type,
    taxpayer_id_last4 = excluded.taxpayer_id_last4,
    taxpayer_id_secret_reference = excluded.taxpayer_id_secret_reference,
    ip_pin_required = excluded.ip_pin_required,
    ip_pin_secret_reference = excluded.ip_pin_secret_reference,
    email = excluded.email,
    phone = excluded.phone,
    address_line1 = excluded.address_line1,
    address_line2 = excluded.address_line2,
    city = excluded.city,
    state_region = excluded.state_region,
    postal_code = excluded.postal_code,
    country_code = excluded.country_code,
    county = excluded.county,
    prior_year_filed = excluded.prior_year_filed,
    prior_year_filing_status = excluded.prior_year_filing_status,
    identity_verified = excluded.identity_verified,
    intake_status = excluded.intake_status,
    notes = excluded.notes,
    updated_by = v_user,
    updated_at = now()
  returning id into v_profile_id;

  delete from public.tax_client_household_members
  where org_id = v_org and client_id = v_client;

  for v_member in select value from jsonb_array_elements(coalesce(p_household,'[]'::jsonb))
  loop
    if v_member ? 'ssn' or v_member ? 'social_security_number' or v_member ? 'taxpayer_id_full' then
      raise exception 'Raw household taxpayer identifiers are prohibited';
    end if;

    v_member_last4 := nullif(regexp_replace(coalesce(v_member->>'taxpayer_id_last4',''), '[^0-9]', '', 'g'),'');
    if v_member_last4 is not null and length(v_member_last4) <> 4 then
      raise exception 'Household taxpayer identifier last4 must contain four digits';
    end if;

    insert into public.tax_client_household_members(
      org_id, firm_id, client_id, relationship,
      first_name, middle_name, last_name, date_of_birth,
      taxpayer_id_type, taxpayer_id_last4, taxpayer_id_secret_reference,
      months_lived_with_taxpayer, full_time_student, permanently_disabled,
      gross_income, taxpayer_provided_support_percent, childcare_expenses,
      qualifying_child_candidate, qualifying_relative_candidate,
      dependent_claim_review, notes, created_by, updated_by
    ) values (
      v_org, p_firm_id, v_client,
      coalesce(nullif(trim(v_member->>'relationship'),''),'other'),
      trim(coalesce(v_member->>'first_name','')),
      nullif(trim(coalesce(v_member->>'middle_name','')),''),
      trim(coalesce(v_member->>'last_name','')),
      nullif(v_member->>'date_of_birth','')::date,
      coalesce(nullif(trim(v_member->>'taxpayer_id_type'),''),'ssn'),
      v_member_last4,
      nullif(trim(coalesce(v_member->>'taxpayer_id_secret_reference','')),''),
      nullif(v_member->>'months_lived_with_taxpayer','')::integer,
      coalesce((v_member->>'full_time_student')::boolean,false),
      coalesce((v_member->>'permanently_disabled')::boolean,false),
      nullif(v_member->>'gross_income','')::numeric,
      nullif(v_member->>'taxpayer_provided_support_percent','')::numeric,
      nullif(v_member->>'childcare_expenses','')::numeric,
      coalesce((v_member->>'qualifying_child_candidate')::boolean,false),
      coalesce((v_member->>'qualifying_relative_candidate')::boolean,false),
      'unreviewed',
      nullif(trim(coalesce(v_member->>'notes','')),''),
      v_user, v_user
    );
  end loop;

  insert into public.tax_audit_events(
    org_id, return_id, entity_type, entity_id, action, details, actor_user_id
  ) values (
    v_org, null, 'tax_client_profiles', v_profile_id, 'client_intake_saved',
    jsonb_build_object(
      'client_id', v_client,
      'filing_status', v_filing_status,
      'household_member_count', jsonb_array_length(coalesce(p_household,'[]'::jsonb)),
      'identifier_stored_as_last4_only', true
    ),
    v_user
  );

  return query select p.* from public.tax_client_profiles p where p.id = v_profile_id;
end
$$;

revoke all on function public.tax_upsert_client_intake(uuid,uuid,jsonb,jsonb) from public;
grant execute on function public.tax_upsert_client_intake(uuid,uuid,jsonb,jsonb) to authenticated;

comment on table public.tax_client_profiles is
  'ATLAS Tax client intake extension for advisory clients. Raw SSN/ITIN values are prohibited; only last4 and a secure-vault reference may be stored.';
comment on table public.tax_client_household_members is
  'Spouse/dependent household facts for tax qualification workflows. Raw taxpayer identifiers are prohibited.';
