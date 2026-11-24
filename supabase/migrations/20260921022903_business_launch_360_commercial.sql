-- Business Launch 360 commercial intake, quoting and billing bridge.
-- Anonymous visitors never receive direct table access. Public intake is written only
-- through the bounded atlas-advisory-public Edge Function. Authenticated staff use
-- organization-scoped RPCs for quotation, acceptance, conversion and billing linkage.

create table if not exists public.advisory_launch_intakes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  firm_id uuid not null references public.advisory_firms(id) on delete cascade,
  service_id text not null default 'business-launch-360'
    check (service_id = 'business-launch-360'),
  reference text not null unique,
  full_name text not null check (length(trim(full_name)) > 0),
  business_name text,
  email text not null check (length(trim(email)) > 3),
  phone text,
  website text,
  business_stage text,
  goals text,
  status text not null default 'new'
    check (status in ('new','quoted','accepted','converted','invoiced','closed')),
  quote_amount numeric(14,2)
    check (quote_amount is null or quote_amount > 0),
  quote_tax_rate numeric(7,4)
    check (quote_tax_rate is null or (quote_tax_rate >= 0 and quote_tax_rate <= 100)),
  quote_payment_terms_days integer
    check (quote_payment_terms_days is null or (quote_payment_terms_days >= 0 and quote_payment_terms_days <= 365)),
  quote_currency text not null default 'USD'
    check (quote_currency ~ '^[A-Z]{3}$'),
  quote_note text,
  quote_acceptance_reference text,
  quote_accepted_at timestamptz,
  advisory_client_id uuid references public.advisory_clients(id),
  engagement_id uuid references public.advisory_engagements(id),
  receivable_customer_id uuid references public.customers(id),
  invoice_id uuid references public.invoices(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    quote_accepted_at is null
    or (
      quote_amount is not null
      and quote_tax_rate is not null
      and quote_payment_terms_days is not null
      and length(trim(coalesce(quote_acceptance_reference,''))) > 0
    )
  )
);

create index if not exists advisory_launch_intakes_org_status_idx
  on public.advisory_launch_intakes(org_id, firm_id, status, created_at desc);

create index if not exists advisory_launch_intakes_email_idx
  on public.advisory_launch_intakes(org_id, lower(email));

alter table public.advisory_launch_intakes enable row level security;

drop policy if exists advisory_launch_intakes_read on public.advisory_launch_intakes;
create policy advisory_launch_intakes_read
on public.advisory_launch_intakes
for select
to authenticated
using (public.has_identity_permission(org_id, 'advisory.read'));

revoke all on public.advisory_launch_intakes from anon, authenticated;
grant select on public.advisory_launch_intakes to authenticated;
grant all on public.advisory_launch_intakes to service_role;

drop trigger if exists advisory_launch_intakes_updated_at
on public.advisory_launch_intakes;
create trigger advisory_launch_intakes_updated_at
before update on public.advisory_launch_intakes
for each row execute function public.set_updated_at();

drop trigger if exists advisory_launch_intakes_audit
on public.advisory_launch_intakes;
create trigger advisory_launch_intakes_audit
after insert or update or delete on public.advisory_launch_intakes
for each row execute function public.advisory_log_audit();

create or replace function public.advisory_set_launch_quote(
  p_intake_id uuid,
  p_amount numeric,
  p_tax_rate numeric,
  p_payment_terms_days integer,
  p_note text default null
)
returns setof public.advisory_launch_intakes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_org uuid := public.advisory_actor_org();
begin
  if v_user is null or v_org is null then
    raise exception 'Authentication and active organization required';
  end if;

  if not public.has_identity_permission(v_org, 'advisory.manage') then
    raise exception 'Advisory manage permission required';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Quote amount must be positive';
  end if;

  if p_tax_rate is null or p_tax_rate < 0 or p_tax_rate > 100 then
    raise exception 'Quote tax rate must be between 0 and 100';
  end if;

  if p_payment_terms_days is null
     or p_payment_terms_days < 0
     or p_payment_terms_days > 365 then
    raise exception 'Quote payment terms must be between 0 and 365 days';
  end if;

  update public.advisory_launch_intakes
  set quote_amount = round(p_amount::numeric, 2),
      quote_tax_rate = round(p_tax_rate::numeric, 4),
      quote_payment_terms_days = p_payment_terms_days,
      quote_note = nullif(trim(coalesce(p_note,'')), ''),
      quote_currency = 'USD',
      quote_acceptance_reference = null,
      quote_accepted_at = null,
      status = 'quoted',
      updated_at = now()
  where id = p_intake_id
    and org_id = v_org
    and invoice_id is null
    and status not in ('invoiced','closed');

  if not found then
    raise exception 'Launch intake not available for quotation';
  end if;

  return query
  select i.*
  from public.advisory_launch_intakes i
  where i.id = p_intake_id and i.org_id = v_org;
end
$$;

create or replace function public.advisory_accept_launch_quote(
  p_intake_id uuid,
  p_acceptance_reference text
)
returns setof public.advisory_launch_intakes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_org uuid := public.advisory_actor_org();
begin
  if v_user is null or v_org is null then
    raise exception 'Authentication and active organization required';
  end if;

  if not public.has_identity_permission(v_org, 'advisory.manage') then
    raise exception 'Advisory manage permission required';
  end if;

  if length(trim(coalesce(p_acceptance_reference,''))) = 0 then
    raise exception 'Quote acceptance evidence reference required';
  end if;

  update public.advisory_launch_intakes
  set quote_acceptance_reference = trim(p_acceptance_reference),
      quote_accepted_at = now(),
      status = 'accepted',
      updated_at = now()
  where id = p_intake_id
    and org_id = v_org
    and invoice_id is null
    and quote_amount is not null
    and quote_amount > 0
    and quote_tax_rate is not null
    and quote_payment_terms_days is not null
    and status in ('quoted','accepted');

  if not found then
    raise exception 'Quoted launch intake not available for acceptance';
  end if;

  return query
  select i.*
  from public.advisory_launch_intakes i
  where i.id = p_intake_id and i.org_id = v_org;
end
$$;

create or replace function public.advisory_convert_launch_intake(
  p_intake_id uuid
)
returns setof public.advisory_launch_intakes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_org uuid := public.advisory_actor_org();
  v_intake public.advisory_launch_intakes%rowtype;
  v_client uuid;
  v_engagement uuid;
begin
  if v_user is null or v_org is null then
    raise exception 'Authentication and active organization required';
  end if;

  if not public.has_identity_permission(v_org, 'advisory.manage') then
    raise exception 'Advisory manage permission required';
  end if;

  select *
  into v_intake
  from public.advisory_launch_intakes
  where id = p_intake_id and org_id = v_org
  for update;

  if v_intake.id is null then
    raise exception 'Launch intake not available';
  end if;

  if v_intake.quote_amount is null
     or v_intake.quote_amount <= 0
     or v_intake.quote_tax_rate is null
     or v_intake.quote_payment_terms_days is null then
    raise exception 'Complete quote required before conversion';
  end if;

  if v_intake.quote_accepted_at is null
     or length(trim(coalesce(v_intake.quote_acceptance_reference,''))) = 0 then
    raise exception 'Quote acceptance evidence required before conversion';
  end if;

  if v_intake.status = 'closed' then
    raise exception 'Closed intake cannot be converted';
  end if;

  v_client := v_intake.advisory_client_id;
  if v_client is null then
    insert into public.advisory_clients(
      org_id,
      firm_id,
      display_name,
      client_type,
      email,
      phone,
      status,
      owner_id,
      created_by
    )
    values (
      v_org,
      v_intake.firm_id,
      coalesce(
        nullif(trim(coalesce(v_intake.business_name,'')), ''),
        v_intake.full_name
      ),
      case
        when nullif(trim(coalesce(v_intake.business_name,'')), '') is null
          then 'person'
        else 'business'
      end,
      v_intake.email,
      v_intake.phone,
      'active',
      v_user,
      v_user
    )
    returning id into v_client;
  end if;

  v_engagement := v_intake.engagement_id;
  if v_engagement is null then
    insert into public.advisory_engagements(
      org_id,
      firm_id,
      client_id,
      service_id,
      title,
      status,
      owner_id,
      starts_on,
      created_by
    )
    values (
      v_org,
      v_intake.firm_id,
      v_client,
      'business-launch-360',
      'Business Launch 360 · ' ||
        coalesce(
          nullif(trim(coalesce(v_intake.business_name,'')), ''),
          v_intake.full_name
        ),
      'open',
      v_user,
      current_date,
      v_user
    )
    returning id into v_engagement;
  end if;

  update public.advisory_launch_intakes
  set advisory_client_id = v_client,
      engagement_id = v_engagement,
      status = case
        when v_intake.status = 'invoiced' then 'invoiced'
        else 'converted'
      end,
      updated_at = now()
  where id = p_intake_id and org_id = v_org;

  return query
  select i.*
  from public.advisory_launch_intakes i
  where i.id = p_intake_id and i.org_id = v_org;
end
$$;

create or replace function public.advisory_set_launch_billing_refs(
  p_intake_id uuid,
  p_receivable_customer_id uuid default null,
  p_invoice_id uuid default null
)
returns setof public.advisory_launch_intakes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_org uuid := public.advisory_actor_org();
  v_intake public.advisory_launch_intakes%rowtype;
  v_customer uuid;
  v_invoice_status text;
begin
  if v_user is null or v_org is null then
    raise exception 'Authentication and active organization required';
  end if;

  if not (
    public.has_identity_permission(v_org, 'advisory.manage')
    or public.has_identity_permission(v_org, 'advisory.billing')
  ) then
    raise exception 'Advisory billing permission required';
  end if;

  select *
  into v_intake
  from public.advisory_launch_intakes
  where id = p_intake_id and org_id = v_org
  for update;

  if v_intake.id is null then
    raise exception 'Launch intake not available';
  end if;

  if v_intake.quote_accepted_at is null
     or length(trim(coalesce(v_intake.quote_acceptance_reference,''))) = 0 then
    raise exception 'Quote acceptance evidence required before billing';
  end if;

  if v_intake.advisory_client_id is null or v_intake.engagement_id is null then
    raise exception 'Launch intake must be converted before billing';
  end if;

  if p_receivable_customer_id is not null
     and not exists (
       select 1
       from public.customers c
       where c.id = p_receivable_customer_id
         and c.org_id = v_org
     ) then
    raise exception 'Receivables customer not available in organization';
  end if;

  if p_invoice_id is not null then
    select inv.customer_id, inv.status
    into v_customer, v_invoice_status
    from public.invoices inv
    where inv.id = p_invoice_id
      and inv.org_id = v_org
      and inv.status in ('draft','open');

    if v_customer is null then
      raise exception 'Invoice not available in organization';
    end if;

    if coalesce(p_receivable_customer_id, v_intake.receivable_customer_id) is not null
       and v_customer <> coalesce(
         p_receivable_customer_id,
         v_intake.receivable_customer_id
       ) then
      raise exception 'Invoice customer does not match launch intake billing customer';
    end if;
  end if;

  update public.advisory_launch_intakes
  set receivable_customer_id = coalesce(
        p_receivable_customer_id,
        receivable_customer_id
      ),
      invoice_id = coalesce(p_invoice_id, invoice_id),
      status = case
        when p_invoice_id is not null and v_invoice_status = 'open'
          then 'invoiced'
        else status
      end,
      updated_at = now()
  where id = p_intake_id and org_id = v_org;

  return query
  select i.*
  from public.advisory_launch_intakes i
  where i.id = p_intake_id and i.org_id = v_org;
end
$$;

revoke all on function public.advisory_set_launch_quote(
  uuid,numeric,numeric,integer,text
) from public;
revoke all on function public.advisory_accept_launch_quote(uuid,text) from public;
revoke all on function public.advisory_convert_launch_intake(uuid) from public;
revoke all on function public.advisory_set_launch_billing_refs(
  uuid,uuid,uuid
) from public;

grant execute on function public.advisory_set_launch_quote(
  uuid,numeric,numeric,integer,text
) to authenticated;
grant execute on function public.advisory_accept_launch_quote(uuid,text) to authenticated;
grant execute on function public.advisory_convert_launch_intake(uuid) to authenticated;
grant execute on function public.advisory_set_launch_billing_refs(
  uuid,uuid,uuid
) to authenticated;

comment on table public.advisory_launch_intakes is
  'Public Business Launch 360 requests routed to one active Advisory firm. Anonymous users have no direct table access.';
