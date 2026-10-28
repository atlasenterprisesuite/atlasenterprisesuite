-- ATLAS Network governed mutations and permission registry.
-- Sensitive ledger, rank, payout, and compliance operations are exposed only
-- through authorization-aware RPCs. Direct browser mutations remain revoked.

insert into public.identity_permissions (code, description)
values
  ('network.view', 'Open the ATLAS Network workspace for an organization.'),
  ('network.partner.self', 'View the authenticated partner own Network profile and earnings state.'),
  ('network.partners.manage', 'Administer organization-scoped Network partners and referrals.'),
  ('network.pricing.view', 'Read Network price books and product pricing.'),
  ('network.pricing.manage', 'Create and approve versioned Network price books.'),
  ('network.commissions.view', 'Read Network commission events and balances.'),
  ('network.commissions.manage_rules', 'Administer commission rules and governed ledger posting.'),
  ('network.payouts.view', 'Read Network payout batches and settlement state.'),
  ('network.payouts.approve', 'Approve and transition governed Network payout batches.'),
  ('network.compliance.view', 'Read Network compliance events.'),
  ('network.compliance.manage', 'Administer Network compliance actions, holds, and rank overrides.'),
  ('network.analytics.view', 'Read organization-scoped Network analytics.'),
  ('network.audit.view', 'Read Network audit evidence.')
on conflict (code) do update
set description = excluded.description;

insert into public.identity_role_permissions (role, permission_code)
select role_name, permission_code
from (
  values
    ('owner','network.view'),
    ('owner','network.partner.self'),
    ('owner','network.partners.manage'),
    ('owner','network.pricing.view'),
    ('owner','network.pricing.manage'),
    ('owner','network.commissions.view'),
    ('owner','network.commissions.manage_rules'),
    ('owner','network.payouts.view'),
    ('owner','network.payouts.approve'),
    ('owner','network.compliance.view'),
    ('owner','network.compliance.manage'),
    ('owner','network.analytics.view'),
    ('owner','network.audit.view'),
    ('admin','network.view'),
    ('admin','network.partner.self'),
    ('admin','network.partners.manage'),
    ('admin','network.pricing.view'),
    ('admin','network.pricing.manage'),
    ('admin','network.commissions.view'),
    ('admin','network.commissions.manage_rules'),
    ('admin','network.payouts.view'),
    ('admin','network.payouts.approve'),
    ('admin','network.compliance.view'),
    ('admin','network.compliance.manage'),
    ('admin','network.analytics.view'),
    ('admin','network.audit.view')
) as network_permissions(role_name, permission_code)
on conflict do nothing;

alter table public.network_commission_events
  add column if not exists reason text;

-- Bootstrap the approved launch price book for one organization only.
create or replace function public.bootstrap_network_launch_price_book(
  organization_uuid uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_uuid uuid := auth.uid();
  book_uuid uuid;
begin
  if actor_uuid is null then
    raise exception 'Authentication required';
  end if;

  if not public.has_identity_permission(organization_uuid,'network.pricing.manage') then
    raise exception 'Network pricing permission required';
  end if;

  select id into book_uuid
  from public.network_price_books
  where org_id = organization_uuid
    and name = 'GLOBAL-USD-LAUNCH-V1'
    and version = 1
  limit 1;

  if book_uuid is null then
    insert into public.network_price_books (
      org_id,
      name,
      version,
      country_code,
      currency,
      effective_from,
      status,
      approved_by,
      approved_at,
      created_by
    )
    values (
      organization_uuid,
      'GLOBAL-USD-LAUNCH-V1',
      1,
      null,
      'USD',
      now(),
      'active',
      actor_uuid,
      now(),
      actor_uuid
    )
    returning id into book_uuid;
  end if;

  insert into public.network_product_prices (
    org_id,
    price_book_id,
    product_key,
    billing_interval,
    currency,
    amount_minor,
    base_usd_amount_minor,
    commissionable,
    product_commission_cap_bps,
    tax_code
  )
  values
    (organization_uuid, book_uuid, 'atlas-free', 'monthly', 'USD', 0, 0, false, 0, 'standard'),
    (organization_uuid, book_uuid, 'atlas-core-monthly', 'monthly', 'USD', 2900, 2900, true, 2000, 'standard'),
    (organization_uuid, book_uuid, 'atlas-core-annual', 'annual', 'USD', 29000, 29000, true, 2000, 'standard'),
    (organization_uuid, book_uuid, 'atlas-pro-monthly', 'monthly', 'USD', 5900, 5900, true, 2000, 'standard'),
    (organization_uuid, book_uuid, 'atlas-pro-annual', 'annual', 'USD', 59000, 59000, true, 2000, 'standard'),
    (organization_uuid, book_uuid, 'atlas-business-monthly', 'monthly', 'USD', 14900, 14900, true, 2000, 'standard'),
    (organization_uuid, book_uuid, 'atlas-business-annual', 'annual', 'USD', 149000, 149000, true, 2000, 'standard'),
    (organization_uuid, book_uuid, 'atlas-enterprise-monthly', 'monthly', 'USD', 99900, 99900, true, 2000, 'standard'),
    (organization_uuid, book_uuid, 'atlas-enterprise-annual', 'annual', 'USD', 999000, 999000, true, 2000, 'standard'),
    (organization_uuid, book_uuid, 'atlas-business-seat', 'monthly', 'USD', 3900, 3900, true, 2000, 'standard'),
    (organization_uuid, book_uuid, 'atlas-business-seat-annual', 'annual', 'USD', 39000, 39000, true, 2000, 'standard'),
    (organization_uuid, book_uuid, 'atlas-enterprise-seat', 'monthly', 'USD', 2900, 2900, true, 2000, 'standard'),
    (organization_uuid, book_uuid, 'atlas-enterprise-seat-annual', 'annual', 'USD', 29000, 29000, true, 2000, 'standard'),
    (organization_uuid, book_uuid, 'atlas-network-partner', 'enrollment', 'USD', 0, 0, false, 0, 'noncommissionable')
  on conflict (price_book_id, product_key, billing_interval) do nothing;

  -- atlas-network-partner contract: amount_minor = 0 and commissionable = false.
  -- Partner enrollment is free; Recruitment alone is not commissionable.
  return book_uuid;
end;
$$;

-- Post one immutable commission component after a verified customer-sale event.
create or replace function public.post_network_commission_event(
  organization_uuid uuid,
  partner_uuid uuid,
  source_transaction_value text,
  source_line_value text,
  rule_uuid uuid,
  component_value text,
  cnr_amount_minor_value bigint,
  contribution_margin_minor_value bigint,
  rate_bps_value integer,
  commission_amount_minor_value bigint,
  currency_value text,
  product_cap_bps_value integer default null,
  source_kind_value text default 'customer_sale'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_uuid uuid := auth.uid();
  event_uuid uuid;
  revenue_cap_minor bigint;
  margin_cap_minor bigint;
  pool_cap_minor bigint;
  existing_allocated_minor bigint;
  component_cap_bps integer;
  component_cap_minor bigint;
begin
  if actor_uuid is null then
    raise exception 'Authentication required';
  end if;

  if not public.has_identity_permission(organization_uuid,'network.commissions.manage_rules') then
    raise exception 'Network commission permission required';
  end if;

  if source_kind_value <> 'customer_sale' then
    raise exception 'Recruitment alone is not commissionable';
  end if;

  if source_transaction_value is null or btrim(source_transaction_value) = ''
     or source_line_value is null or btrim(source_line_value) = '' then
    raise exception 'Verified source transaction and line are required';
  end if;

  if cnr_amount_minor_value <= 0 or contribution_margin_minor_value < 0 then
    raise exception 'Commission posting requires positive CNR and nonnegative contribution margin';
  end if;

  if currency_value !~ '^[A-Z]{3}$' then
    raise exception 'Invalid payout currency';
  end if;

  if not exists (
    select 1
    from public.network_commission_rules r
    where r.id = rule_uuid and r.org_id = organization_uuid
  ) then
    raise exception 'Commission rule does not belong to organization';
  end if;

  if not exists (
    select 1
    from public.network_partners p
    where p.id = partner_uuid and p.org_id = organization_uuid and p.status = 'active'
  ) then
    raise exception 'Active partner not found in organization';
  end if;

  component_cap_bps := case component_value
    when 'direct' then 1200
    when 'level2' then 300
    when 'level3' then 150
    when 'leadership' then 150
    when 'campaign' then 200
    else null
  end;

  if component_cap_bps is null then
    raise exception 'Unknown commission component';
  end if;

  if rate_bps_value < 0 or rate_bps_value > component_cap_bps then
    raise exception 'Commission component rate exceeds approved maximum';
  end if;

  if product_cap_bps_value is not null and (product_cap_bps_value < 0 or product_cap_bps_value > 2000) then
    raise exception 'Invalid product commission cap';
  end if;

  revenue_cap_minor := ((cnr_amount_minor_value * least(2000, coalesce(product_cap_bps_value, 2000))) + 5000) / 10000;
  margin_cap_minor := ((contribution_margin_minor_value * 3500) + 5000) / 10000;
  pool_cap_minor := greatest(0, least(revenue_cap_minor, margin_cap_minor));
  component_cap_minor := ((cnr_amount_minor_value * rate_bps_value) + 5000) / 10000;

  if commission_amount_minor_value < 0 or commission_amount_minor_value > component_cap_minor then
    raise exception 'Commission amount exceeds component maximum';
  end if;

  select coalesce(sum(commission_amount_minor), 0)
  into existing_allocated_minor
  from public.network_commission_events
  where org_id = organization_uuid
    and source_transaction_id = source_transaction_value
    and source_line_id = source_line_value
    and rule_id = rule_uuid
    and reversal_of_event_id is null;

  if existing_allocated_minor + commission_amount_minor_value > pool_cap_minor then
    raise exception 'Commission allocation exceeds funded pool cap';
  end if;

  insert into public.network_commission_events (
    org_id,
    partner_id,
    source_transaction_id,
    source_line_id,
    rule_id,
    component,
    cnr_amount_minor,
    contribution_margin_minor,
    commission_rate_bps,
    commission_amount_minor,
    currency,
    status,
    available_at,
    created_by
  )
  values (
    organization_uuid,
    partner_uuid,
    source_transaction_value,
    source_line_value,
    rule_uuid,
    component_value,
    cnr_amount_minor_value,
    contribution_margin_minor_value,
    rate_bps_value,
    commission_amount_minor_value,
    currency_value,
    'pending',
    null,
    actor_uuid
  )
  on conflict do nothing
  returning id into event_uuid;

  if event_uuid is null then
    select id into event_uuid
    from public.network_commission_events
    where org_id = organization_uuid
      and source_transaction_id = source_transaction_value
      and source_line_id = source_line_value
      and partner_id = partner_uuid
      and component = component_value
      and rule_id = rule_uuid
      and reversal_of_event_id is null
    order by created_at asc
    limit 1;
  end if;

  return event_uuid;
end;
$$;

-- Reverse by appending a signed counter-event. The original ledger row remains immutable evidence.
create or replace function public.reverse_network_commission_event(
  event_uuid uuid,
  reason_value text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_uuid uuid := auth.uid();
  original_event public.network_commission_events%rowtype;
  reversal_uuid uuid;
begin
  if actor_uuid is null then
    raise exception 'Authentication required';
  end if;

  select * into original_event
  from public.network_commission_events
  where id = event_uuid;

  if original_event.id is null then
    raise exception 'Commission event not found';
  end if;

  if not public.has_identity_permission(original_event.org_id,'network.commissions.manage_rules') then
    raise exception 'Network commission permission required';
  end if;

  if reason_value is null or btrim(reason_value) = '' then
    raise exception 'Reversal reason is required';
  end if;

  if original_event.reversal_of_event_id is not null then
    raise exception 'A reversal event cannot itself be reversed by this operation';
  end if;

  insert into public.network_commission_events (
    org_id,
    partner_id,
    source_transaction_id,
    source_line_id,
    rule_id,
    component,
    cnr_amount_minor,
    contribution_margin_minor,
    commission_rate_bps,
    commission_amount_minor,
    currency,
    status,
    available_at,
    reversal_of_event_id,
    reason,
    created_by
  )
  values (
    original_event.org_id,
    original_event.partner_id,
    original_event.source_transaction_id,
    original_event.source_line_id,
    original_event.rule_id,
    original_event.component,
    -original_event.cnr_amount_minor,
    -original_event.contribution_margin_minor,
    original_event.commission_rate_bps,
    -original_event.commission_amount_minor,
    original_event.currency,
    'reversed',
    now(),
    original_event.id,
    reason_value,
    actor_uuid
  )
  on conflict do nothing
  returning id into reversal_uuid;

  if reversal_uuid is null then
    select id into reversal_uuid
    from public.network_commission_events
    where reversal_of_event_id = original_event.id
    order by created_at asc
    limit 1;
  end if;

  return reversal_uuid;
end;
$$;

-- Manual rank changes are exceptional and always leave history with an explicit reason.
create or replace function public.override_network_partner_rank(
  organization_uuid uuid,
  partner_uuid uuid,
  rank_value text,
  reason_value text,
  effective_from_value timestamptz default now(),
  qualification_snapshot_value jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_uuid uuid := auth.uid();
  history_uuid uuid;
begin
  if actor_uuid is null then
    raise exception 'Authentication required';
  end if;

  if not public.has_identity_permission(organization_uuid,'network.compliance.manage') then
    raise exception 'Network compliance permission required';
  end if;

  if rank_value not in ('partner','builder','leader','director','global_ambassador') then
    raise exception 'Invalid partner rank';
  end if;

  if reason_value is null or btrim(reason_value) = '' then
    raise exception 'Rank override reason is required';
  end if;

  if not exists (
    select 1 from public.network_partners
    where id = partner_uuid and org_id = organization_uuid
  ) then
    raise exception 'Partner not found in organization';
  end if;

  update public.network_partner_rank_history
  set effective_to = effective_from_value
  where org_id = organization_uuid
    and partner_id = partner_uuid
    and effective_to is null
    and effective_from < effective_from_value;

  insert into public.network_partner_rank_history (
    org_id,
    partner_id,
    rank_key,
    policy_version,
    effective_from,
    qualification_snapshot_json,
    override_reason,
    created_by
  )
  values (
    organization_uuid,
    partner_uuid,
    rank_value,
    'manual-override-v1',
    effective_from_value,
    coalesce(qualification_snapshot_value, '{}'::jsonb),
    reason_value,
    actor_uuid
  )
  returning id into history_uuid;

  update public.network_partners
  set current_rank = rank_value,
      updated_at = now()
  where id = partner_uuid and org_id = organization_uuid;

  return history_uuid;
end;
$$;

-- Payout state machine. Only listed edges are permitted.
-- ('accruing','pending_review')
-- ('pending_review','approved')
-- ('approved','processing')
-- ('processing','paid')
-- ('pending_review','held')
-- ('approved','held')
-- ('processing','failed')
-- ('held','pending_review')
-- ('failed','approved')
-- ('approved','cancelled')
-- ('processing','cancelled')
-- ('paid','reversed')
create or replace function public.transition_network_payout_batch(
  batch_uuid uuid,
  next_status text,
  provider_reference_value text default null
)
returns public.network_payout_batches
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_uuid uuid := auth.uid();
  current_batch public.network_payout_batches%rowtype;
  result_batch public.network_payout_batches%rowtype;
begin
  if actor_uuid is null then
    raise exception 'Authentication required';
  end if;

  select * into current_batch
  from public.network_payout_batches
  where id = batch_uuid
  for update;

  if current_batch.id is null then
    raise exception 'Payout batch not found';
  end if;

  if not public.has_identity_permission(current_batch.org_id,'network.payouts.approve') then
    raise exception 'Network payout approval permission required';
  end if;

  if not (
    (current_batch.status = 'accruing' and next_status = 'pending_review')
    or (current_batch.status = 'pending_review' and next_status = 'approved')
    or (current_batch.status = 'approved' and next_status = 'processing')
    or (current_batch.status = 'processing' and next_status = 'paid')
    or (current_batch.status = 'pending_review' and next_status = 'held')
    or (current_batch.status = 'approved' and next_status = 'held')
    or (current_batch.status = 'processing' and next_status = 'failed')
    or (current_batch.status = 'held' and next_status = 'pending_review')
    or (current_batch.status = 'failed' and next_status = 'approved')
    or (current_batch.status = 'approved' and next_status = 'cancelled')
    or (current_batch.status = 'processing' and next_status = 'cancelled')
    or (current_batch.status = 'paid' and next_status = 'reversed')
  ) then
    raise exception 'Invalid payout state transition from % to %', current_batch.status, next_status;
  end if;

  if next_status = 'paid'
     and coalesce(nullif(btrim(provider_reference_value), ''), nullif(btrim(current_batch.provider_reference), '')) is null then
    raise exception 'Paid status requires settlement evidence';
  end if;

  if next_status = 'reversed'
     and coalesce(nullif(btrim(provider_reference_value), ''), nullif(btrim(current_batch.provider_reference), '')) is null then
    raise exception 'Settlement reversal requires evidence';
  end if;

  update public.network_payout_batches
  set status = next_status,
      provider_reference = coalesce(nullif(btrim(provider_reference_value), ''), provider_reference),
      approved_by = case when next_status = 'approved' then actor_uuid else approved_by end,
      approved_at = case when next_status = 'approved' then now() else approved_at end,
      updated_at = now()
  where id = batch_uuid
  returning * into result_batch;

  return result_batch;
end;
$$;

create or replace function public.record_network_compliance_event(
  organization_uuid uuid,
  partner_uuid uuid,
  event_type_value text,
  severity_value text,
  evidence_value jsonb,
  action_value text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_uuid uuid := auth.uid();
  compliance_uuid uuid;
begin
  if actor_uuid is null then
    raise exception 'Authentication required';
  end if;

  if not public.has_identity_permission(organization_uuid,'network.compliance.manage') then
    raise exception 'Network compliance permission required';
  end if;

  if event_type_value is null or btrim(event_type_value) = '' then
    raise exception 'Compliance event type is required';
  end if;

  if severity_value not in ('info','low','medium','high','critical') then
    raise exception 'Invalid compliance severity';
  end if;

  if partner_uuid is not null and not exists (
    select 1 from public.network_partners
    where id = partner_uuid and org_id = organization_uuid
  ) then
    raise exception 'Partner not found in organization';
  end if;

  insert into public.network_compliance_events (
    org_id,
    partner_id,
    event_type,
    severity,
    status,
    evidence_json,
    action_taken,
    created_by
  )
  values (
    organization_uuid,
    partner_uuid,
    event_type_value,
    severity_value,
    'open',
    coalesce(evidence_value, '{}'::jsonb),
    action_value,
    actor_uuid
  )
  returning id into compliance_uuid;

  if partner_uuid is not null and action_value = 'hold_payouts' then
    update public.network_partners
    set compliance_status = 'held', updated_at = now()
    where id = partner_uuid and org_id = organization_uuid;
  end if;

  return compliance_uuid;
end;
$$;

-- Free partner enrollment. No invoice, fee, commission event, or rank-production event is generated here.
create or replace function public.create_network_partner(
  organization_uuid uuid,
  country_code_value text,
  payout_currency_value text,
  sponsor_partner_uuid uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  actor_uuid uuid := auth.uid();
  partner_uuid uuid;
  generated_code text;
begin
  if actor_uuid is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_org_member(organization_uuid) then
    raise exception 'Organization membership required';
  end if;

  if country_code_value !~ '^[A-Z]{2}$' or payout_currency_value !~ '^[A-Z]{3}$' then
    raise exception 'Invalid country or payout currency';
  end if;

  select id into partner_uuid
  from public.network_partners
  where org_id = organization_uuid and user_id = actor_uuid
  limit 1;

  if partner_uuid is not null then
    return partner_uuid;
  end if;

  if sponsor_partner_uuid is not null then
    if not exists (
      select 1 from public.network_partners s
      where s.id = sponsor_partner_uuid
        and s.org_id = organization_uuid
        and s.status = 'active'
    ) then
      raise exception 'Sponsor must be an active partner in the same organization';
    end if;

    if exists (
      select 1 from public.network_partners s
      where s.id = sponsor_partner_uuid and s.user_id = actor_uuid
    ) then
      raise exception 'Self sponsorship is not permitted';
    end if;
  end if;

  generated_code := 'NET-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  insert into public.network_partners (
    org_id,
    user_id,
    partner_code,
    status,
    country_code,
    payout_currency,
    sponsor_partner_id,
    current_rank,
    compliance_status,
    created_by
  )
  values (
    organization_uuid,
    actor_uuid,
    generated_code,
    'active',
    country_code_value,
    payout_currency_value,
    sponsor_partner_uuid,
    'partner',
    'clear',
    actor_uuid
  )
  returning id into partner_uuid;

  -- Recruitment alone is not commissionable. Enrollment produces no commission row.
  return partner_uuid;
end;
$$;

revoke all on function public.bootstrap_network_launch_price_book(uuid) from public;
revoke all on function public.create_network_partner(uuid,text,text,uuid) from public;
revoke all on function public.post_network_commission_event(uuid,uuid,text,text,uuid,text,bigint,bigint,integer,bigint,text,integer,text) from public;
revoke all on function public.reverse_network_commission_event(uuid,text) from public;
revoke all on function public.override_network_partner_rank(uuid,uuid,text,text,timestamptz,jsonb) from public;
revoke all on function public.transition_network_payout_batch(uuid,text,text) from public;
revoke all on function public.record_network_compliance_event(uuid,uuid,text,text,jsonb,text) from public;

grant execute on function public.bootstrap_network_launch_price_book(uuid) to authenticated;
grant execute on function public.create_network_partner(uuid,text,text,uuid) to authenticated;
grant execute on function public.post_network_commission_event(uuid,uuid,text,text,uuid,text,bigint,bigint,integer,bigint,text,integer,text) to authenticated;
grant execute on function public.reverse_network_commission_event(uuid,text) to authenticated;
grant execute on function public.override_network_partner_rank(uuid,uuid,text,text,timestamptz,jsonb) to authenticated;
grant execute on function public.transition_network_payout_batch(uuid,text,text) to authenticated;
grant execute on function public.record_network_compliance_event(uuid,uuid,text,text,jsonb,text) to authenticated;
