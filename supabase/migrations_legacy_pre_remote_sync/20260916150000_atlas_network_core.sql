-- ATLAS Network core persistence
-- Organization-scoped, auditable, versioned, and intentionally conservative about direct writes.

create table if not exists public.network_partners (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  partner_code text not null,
  status text not null default 'active'
    check (status in ('pending','active','held','suspended','closed')),
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  payout_currency text not null check (payout_currency ~ '^[A-Z]{3}$'),
  sponsor_partner_id uuid references public.network_partners(id) on delete set null,
  current_rank text not null default 'partner'
    check (current_rank in ('partner','builder','leader','director','global_ambassador')),
  compliance_status text not null default 'clear'
    check (compliance_status in ('clear','review','held','restricted')),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, user_id),
  unique (org_id, partner_code),
  check (sponsor_partner_id is null or sponsor_partner_id <> id)
);

create index if not exists network_partners_org_status_idx
  on public.network_partners(org_id, status);
create index if not exists network_partners_sponsor_idx
  on public.network_partners(org_id, sponsor_partner_id)
  where sponsor_partner_id is not null;

create table if not exists public.network_referral_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  partner_id uuid not null references public.network_partners(id) on delete cascade,
  code text not null,
  campaign_id text,
  status text not null default 'active'
    check (status in ('active','disabled','expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (org_id, code),
  check (expires_at is null or expires_at > created_at)
);

create index if not exists network_referral_links_partner_idx
  on public.network_referral_links(org_id, partner_id, status);

create table if not exists public.network_attributions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  partner_id uuid not null references public.network_partners(id) on delete restrict,
  customer_id text not null,
  source text not null,
  campaign_id text,
  policy_version text not null,
  first_touch_at timestamptz not null,
  converted_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending','qualified','converted','rejected','reversed')),
  evidence_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (converted_at is null or converted_at >= first_touch_at)
);

create unique index if not exists network_attributions_one_conversion_owner_idx
  on public.network_attributions(org_id, customer_id)
  where status in ('qualified','converted');
create index if not exists network_attributions_partner_idx
  on public.network_attributions(org_id, partner_id, status);

create table if not exists public.network_price_books (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  version integer not null check (version > 0),
  country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  effective_from timestamptz not null,
  effective_to timestamptz,
  status text not null default 'draft'
    check (status in ('draft','active','retired')),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, name, version),
  check (effective_to is null or effective_to > effective_from),
  check ((status <> 'active') or approved_by is not null)
);

create index if not exists network_price_books_effective_idx
  on public.network_price_books(org_id, currency, effective_from, effective_to);

create table if not exists public.network_product_prices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  price_book_id uuid not null references public.network_price_books(id) on delete restrict,
  product_key text not null,
  billing_interval text not null
    check (billing_interval in ('monthly','annual','enrollment')),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount_minor bigint not null check (amount_minor >= 0),
  base_usd_amount_minor bigint not null check (base_usd_amount_minor >= 0),
  commissionable boolean not null default true,
  product_commission_cap_bps integer
    check (product_commission_cap_bps is null or product_commission_cap_bps between 0 and 2000),
  tax_code text not null,
  fx_rate numeric(20,10),
  fx_source text,
  fx_captured_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (price_book_id, product_key, billing_interval),
  check (
    (currency = 'USD' and (fx_rate is null or fx_rate > 0))
    or
    (currency <> 'USD' and fx_rate is not null and fx_rate > 0 and fx_source is not null and fx_captured_at is not null)
  )
);

create index if not exists network_product_prices_org_product_idx
  on public.network_product_prices(org_id, product_key, billing_interval);

create table if not exists public.network_commission_rules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  version integer not null check (version > 0),
  effective_from timestamptz not null,
  effective_to timestamptz,
  status text not null default 'draft'
    check (status in ('draft','active','retired')),
  pool_cap_bps integer not null default 2000
    check (pool_cap_bps between 0 and 2000),
  margin_cap_bps integer not null default 3500
    check (margin_cap_bps between 0 and 3500),
  rules_json jsonb not null default '{}'::jsonb,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, version),
  check (effective_to is null or effective_to > effective_from),
  check ((status <> 'active') or approved_by is not null)
);

create table if not exists public.network_commission_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  partner_id uuid not null references public.network_partners(id) on delete restrict,
  source_transaction_id text not null,
  source_line_id text not null,
  rule_id uuid not null references public.network_commission_rules(id) on delete restrict,
  component text not null
    check (component in ('direct','level2','level3','leadership','campaign')),
  cnr_amount_minor bigint not null,
  contribution_margin_minor bigint not null,
  commission_rate_bps integer not null check (commission_rate_bps between 0 and 2000),
  commission_amount_minor bigint not null,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'estimated'
    check (status in ('estimated','pending','available','held','paid','reversed')),
  available_at timestamptz,
  reversal_of_event_id uuid references public.network_commission_events(id) on delete restrict,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (reversal_of_event_id is null or reversal_of_event_id <> id),
  check ((status <> 'reversed') or reversal_of_event_id is not null)
);

create unique index if not exists network_commission_events_idempotency_idx
  on public.network_commission_events(
    org_id,
    source_transaction_id,
    source_line_id,
    partner_id,
    component,
    rule_id,
    coalesce(reversal_of_event_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );
create index if not exists network_commission_events_partner_status_idx
  on public.network_commission_events(org_id, partner_id, status, created_at desc);

create table if not exists public.network_payout_batches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  period_start timestamptz not null,
  period_end timestamptz not null,
  status text not null default 'accruing'
    check (status in ('accruing','pending_review','approved','processing','paid','held','failed','reversed','cancelled')),
  gross_commissions_minor bigint not null default 0,
  holds_minor bigint not null default 0,
  offsets_minor bigint not null default 0,
  net_payout_minor bigint not null default 0,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  provider_reference text,
  settlement_evidence_json jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end > period_start),
  check ((status <> 'paid') or provider_reference is not null),
  check (gross_commissions_minor >= 0),
  check (holds_minor >= 0),
  check (offsets_minor >= 0),
  check (net_payout_minor >= 0)
);

create index if not exists network_payout_batches_org_status_idx
  on public.network_payout_batches(org_id, status, period_end desc);

create table if not exists public.network_partner_rank_history (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  partner_id uuid not null references public.network_partners(id) on delete cascade,
  rank_key text not null
    check (rank_key in ('partner','builder','leader','director','global_ambassador')),
  policy_version text not null,
  effective_from timestamptz not null,
  effective_to timestamptz,
  qualification_snapshot_json jsonb not null default '{}'::jsonb,
  override_reason text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (effective_to is null or effective_to > effective_from)
);

create index if not exists network_partner_rank_history_partner_idx
  on public.network_partner_rank_history(org_id, partner_id, effective_from desc);

create table if not exists public.network_compliance_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  partner_id uuid references public.network_partners(id) on delete set null,
  event_type text not null,
  severity text not null check (severity in ('info','low','medium','high','critical')),
  status text not null default 'open'
    check (status in ('open','reviewing','resolved','dismissed')),
  evidence_json jsonb not null default '{}'::jsonb,
  action_taken text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists network_compliance_events_org_status_idx
  on public.network_compliance_events(org_id, status, severity, created_at desc);
create index if not exists network_compliance_events_partner_idx
  on public.network_compliance_events(org_id, partner_id, created_at desc)
  where partner_id is not null;

-- Row-level security. Every Network table is tenant scoped.
alter table public.network_partners enable row level security;
alter table public.network_referral_links enable row level security;
alter table public.network_attributions enable row level security;
alter table public.network_price_books enable row level security;
alter table public.network_product_prices enable row level security;
alter table public.network_commission_rules enable row level security;
alter table public.network_commission_events enable row level security;
alter table public.network_payout_batches enable row level security;
alter table public.network_partner_rank_history enable row level security;
alter table public.network_compliance_events enable row level security;

-- Read access is explicit. Partner-sensitive rows are limited to self unless the actor has elevated Network permissions.
drop policy if exists network_partners_read on public.network_partners;
create policy network_partners_read
on public.network_partners for select
to authenticated
using (
  public.is_org_member(org_id)
  and (
    user_id = auth.uid()
    or public.has_identity_permission(org_id,'network.partners.manage')
    or public.has_identity_permission(org_id,'network.analytics.view')
  )
);

drop policy if exists network_partners_manage on public.network_partners;
create policy network_partners_manage
on public.network_partners for update
to authenticated
using (public.has_identity_permission(org_id,'network.partners.manage'))
with check (public.has_identity_permission(org_id,'network.partners.manage'));

drop policy if exists network_referral_links_read on public.network_referral_links;
create policy network_referral_links_read
on public.network_referral_links for select
to authenticated
using (
  public.is_org_member(org_id)
  and (
    exists (
      select 1 from public.network_partners p
      where p.id = partner_id and p.org_id = org_id and p.user_id = auth.uid()
    )
    or public.has_identity_permission(org_id,'network.partners.manage')
  )
);

drop policy if exists network_attributions_read on public.network_attributions;
create policy network_attributions_read
on public.network_attributions for select
to authenticated
using (
  public.is_org_member(org_id)
  and (
    exists (
      select 1 from public.network_partners p
      where p.id = partner_id and p.org_id = org_id and p.user_id = auth.uid()
    )
    or public.has_identity_permission(org_id,'network.partners.manage')
    or public.has_identity_permission(org_id,'network.analytics.view')
  )
);

drop policy if exists network_price_books_read on public.network_price_books;
create policy network_price_books_read
on public.network_price_books for select
to authenticated
using (public.is_org_member(org_id));

drop policy if exists network_price_books_manage on public.network_price_books;
create policy network_price_books_manage
on public.network_price_books for all
to authenticated
using (public.has_identity_permission(org_id,'network.pricing.manage'))
with check (public.has_identity_permission(org_id,'network.pricing.manage'));

drop policy if exists network_product_prices_read on public.network_product_prices;
create policy network_product_prices_read
on public.network_product_prices for select
to authenticated
using (public.is_org_member(org_id));

drop policy if exists network_product_prices_manage on public.network_product_prices;
create policy network_product_prices_manage
on public.network_product_prices for all
to authenticated
using (public.has_identity_permission(org_id,'network.pricing.manage'))
with check (public.has_identity_permission(org_id,'network.pricing.manage'));

drop policy if exists network_commission_rules_read on public.network_commission_rules;
create policy network_commission_rules_read
on public.network_commission_rules for select
to authenticated
using (
  public.is_org_member(org_id)
  and (
    public.has_identity_permission(org_id,'network.commissions.view')
    or public.has_identity_permission(org_id,'network.commissions.manage_rules')
  )
);

drop policy if exists network_commission_rules_manage on public.network_commission_rules;
create policy network_commission_rules_manage
on public.network_commission_rules for all
to authenticated
using (public.has_identity_permission(org_id,'network.commissions.manage_rules'))
with check (public.has_identity_permission(org_id,'network.commissions.manage_rules'));

drop policy if exists network_commission_events_read on public.network_commission_events;
create policy network_commission_events_read
on public.network_commission_events for select
to authenticated
using (
  public.is_org_member(org_id)
  and (
    exists (
      select 1 from public.network_partners p
      where p.id = partner_id and p.org_id = org_id and p.user_id = auth.uid()
    )
    or public.has_identity_permission(org_id,'network.commissions.view')
  )
);

-- Defense in depth only: authenticated clients do not receive direct mutation grants on ledger events.
drop policy if exists network_commission_events_guarded_update on public.network_commission_events;
create policy network_commission_events_guarded_update
on public.network_commission_events for update
to authenticated
using (public.has_identity_permission(org_id,'network.commissions.manage_rules'))
with check (public.has_identity_permission(org_id,'network.commissions.manage_rules'));

drop policy if exists network_payout_batches_read on public.network_payout_batches;
create policy network_payout_batches_read
on public.network_payout_batches for select
to authenticated
using (
  public.is_org_member(org_id)
  and public.has_identity_permission(org_id,'network.payouts.view')
);

-- State transitions are RPC-governed in the next migration. This policy is an additional guard, not a direct browser capability.
drop policy if exists network_payout_batches_approve_guard on public.network_payout_batches;
create policy network_payout_batches_approve_guard
on public.network_payout_batches for update
to authenticated
using (public.has_identity_permission(org_id,'network.payouts.approve'))
with check (public.has_identity_permission(org_id,'network.payouts.approve'));

drop policy if exists network_partner_rank_history_read on public.network_partner_rank_history;
create policy network_partner_rank_history_read
on public.network_partner_rank_history for select
to authenticated
using (
  public.is_org_member(org_id)
  and (
    exists (
      select 1 from public.network_partners p
      where p.id = partner_id and p.org_id = org_id and p.user_id = auth.uid()
    )
    or public.has_identity_permission(org_id,'network.partners.manage')
    or public.has_identity_permission(org_id,'network.analytics.view')
  )
);

drop policy if exists network_compliance_events_read on public.network_compliance_events;
create policy network_compliance_events_read
on public.network_compliance_events for select
to authenticated
using (
  public.is_org_member(org_id)
  and (
    public.has_identity_permission(org_id,'network.compliance.view')
    or public.has_identity_permission(org_id,'network.compliance.manage')
  )
);

drop policy if exists network_compliance_events_manage on public.network_compliance_events;
create policy network_compliance_events_manage
on public.network_compliance_events for all
to authenticated
using (public.has_identity_permission(org_id,'network.compliance.manage'))
with check (public.has_identity_permission(org_id,'network.compliance.manage'));

-- Table privileges: authenticated users may read through RLS. Only price/rule administration has direct RLS-governed writes.
grant select on public.network_partners to authenticated;
grant select on public.network_referral_links to authenticated;
grant select on public.network_attributions to authenticated;
grant select, insert, update on public.network_price_books to authenticated;
grant select, insert, update on public.network_product_prices to authenticated;
grant select, insert, update on public.network_commission_rules to authenticated;
grant select on public.network_commission_events to authenticated;
grant select on public.network_payout_batches to authenticated;
grant select on public.network_partner_rank_history to authenticated;
grant select on public.network_compliance_events to authenticated;

revoke insert, update, delete on public.network_commission_events from anon, authenticated;
revoke insert, update, delete on public.network_payout_batches from anon, authenticated;
revoke insert, update, delete on public.network_partner_rank_history from anon, authenticated;
revoke insert, update, delete on public.network_partners from anon, authenticated;
revoke insert, update, delete on public.network_referral_links from anon, authenticated;
revoke insert, update, delete on public.network_attributions from anon, authenticated;
revoke insert, update, delete on public.network_compliance_events from anon, authenticated;
revoke all on public.network_partners from anon;
revoke all on public.network_referral_links from anon;
revoke all on public.network_attributions from anon;
revoke all on public.network_price_books from anon;
revoke all on public.network_product_prices from anon;
revoke all on public.network_commission_rules from anon;
revoke all on public.network_commission_events from anon;
revoke all on public.network_payout_batches from anon;
revoke all on public.network_partner_rank_history from anon;
revoke all on public.network_compliance_events from anon;

-- Privileged and financial history is audited using the canonical ATLAS audit function.
drop trigger if exists network_price_books_audit on public.network_price_books;
create trigger network_price_books_audit
after insert or update or delete on public.network_price_books
for each row execute function public.audit_row_change();

drop trigger if exists network_product_prices_audit on public.network_product_prices;
create trigger network_product_prices_audit
after insert or update or delete on public.network_product_prices
for each row execute function public.audit_row_change();

drop trigger if exists network_commission_rules_audit on public.network_commission_rules;
create trigger network_commission_rules_audit
after insert or update or delete on public.network_commission_rules
for each row execute function public.audit_row_change();

drop trigger if exists network_commission_events_audit on public.network_commission_events;
create trigger network_commission_events_audit
after insert or update or delete on public.network_commission_events
for each row execute function public.audit_row_change();

drop trigger if exists network_payout_batches_audit on public.network_payout_batches;
create trigger network_payout_batches_audit
after insert or update or delete on public.network_payout_batches
for each row execute function public.audit_row_change();

drop trigger if exists network_partner_rank_history_audit on public.network_partner_rank_history;
create trigger network_partner_rank_history_audit
after insert or update or delete on public.network_partner_rank_history
for each row execute function public.audit_row_change();

drop trigger if exists network_compliance_events_audit on public.network_compliance_events;
create trigger network_compliance_events_audit
after insert or update or delete on public.network_compliance_events
for each row execute function public.audit_row_change();
