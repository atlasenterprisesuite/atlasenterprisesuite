-- ATLAS Commerce core persistence.
-- Commerce is organization-scoped. Current canonical tenancy maps tenant_id = org_id.

create table if not exists public.commerce_storefronts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  slug text not null check (length(trim(slug)) > 0),
  name text not null check (length(trim(name)) > 0),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commerce_storefronts_scope_check check (tenant_id = org_id),
  constraint commerce_storefronts_scope_identity unique (id, tenant_id, org_id),
  constraint commerce_storefronts_slug_unique unique (tenant_id, org_id, slug)
);

create table if not exists public.commerce_products (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  storefront_id uuid not null,
  title text not null check (length(trim(title)) > 0),
  slug text not null check (length(trim(slug)) > 0),
  description text,
  state text not null default 'draft' check (state in ('draft','published','archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commerce_products_scope_check check (tenant_id = org_id),
  constraint commerce_products_scope_identity unique (id, tenant_id, org_id),
  constraint commerce_products_slug_unique unique (tenant_id, org_id, storefront_id, slug),
  constraint commerce_products_storefront_fk foreign key (storefront_id, tenant_id, org_id)
    references public.commerce_storefronts(id, tenant_id, org_id) on delete cascade
);

create table if not exists public.commerce_product_variants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null,
  sku text not null check (length(trim(sku)) > 0),
  title text not null check (length(trim(title)) > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  price_minor bigint not null check (price_minor >= 0),
  state text not null default 'draft' check (state in ('draft','published','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commerce_product_variants_scope_check check (tenant_id = org_id),
  constraint commerce_product_variants_scope_identity unique (id, tenant_id, org_id),
  constraint commerce_product_variants_sku_unique unique (tenant_id, org_id, sku),
  constraint commerce_product_variants_product_fk foreign key (product_id, tenant_id, org_id)
    references public.commerce_products(id, tenant_id, org_id) on delete cascade
);

create table if not exists public.commerce_product_media (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null,
  variant_id uuid,
  asset_source text not null check (asset_source in (
    'library_blueprint','library_image','library_video','library_audio','creator_asset'
  )),
  asset_id text not null check (length(trim(asset_id)) > 0),
  media_type text not null check (media_type in ('image','video','audio','blueprint')),
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint commerce_product_media_scope_check check (tenant_id = org_id),
  constraint commerce_product_media_product_fk foreign key (product_id, tenant_id, org_id)
    references public.commerce_products(id, tenant_id, org_id) on delete cascade,
  constraint commerce_product_media_variant_fk foreign key (variant_id, tenant_id, org_id)
    references public.commerce_product_variants(id, tenant_id, org_id) on delete cascade
);

create table if not exists public.commerce_carts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  storefront_id uuid not null,
  customer_ref text,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  state text not null default 'active' check (state in ('active','converted','abandoned','expired')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commerce_carts_scope_check check (tenant_id = org_id),
  constraint commerce_carts_scope_identity unique (id, tenant_id, org_id),
  constraint commerce_carts_storefront_fk foreign key (storefront_id, tenant_id, org_id)
    references public.commerce_storefronts(id, tenant_id, org_id) on delete restrict
);

create table if not exists public.commerce_cart_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  cart_id uuid not null,
  variant_id uuid not null,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commerce_cart_lines_scope_check check (tenant_id = org_id),
  constraint commerce_cart_lines_cart_variant_unique unique (cart_id, variant_id),
  constraint commerce_cart_lines_cart_fk foreign key (cart_id, tenant_id, org_id)
    references public.commerce_carts(id, tenant_id, org_id) on delete cascade,
  constraint commerce_cart_lines_variant_fk foreign key (variant_id, tenant_id, org_id)
    references public.commerce_product_variants(id, tenant_id, org_id) on delete restrict
);

create table if not exists public.commerce_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  cart_id uuid not null,
  state text not null default 'draft' check (state in (
    'draft','validating','payment_pending','payment_processing','completed','failed','expired'
  )),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  subtotal_minor bigint not null default 0 check (subtotal_minor >= 0),
  adjustment_minor bigint not null default 0,
  shipping_minor bigint not null default 0 check (shipping_minor >= 0),
  tax_minor bigint not null default 0 check (tax_minor >= 0),
  total_minor bigint not null default 0 check (total_minor >= 0),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commerce_checkout_sessions_scope_check check (tenant_id = org_id),
  constraint commerce_checkout_sessions_scope_identity unique (id, tenant_id, org_id),
  constraint commerce_checkout_cart_unique unique (cart_id),
  constraint commerce_checkout_sessions_cart_fk foreign key (cart_id, tenant_id, org_id)
    references public.commerce_carts(id, tenant_id, org_id) on delete restrict
);

create table if not exists public.commerce_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  storefront_id uuid not null,
  checkout_id uuid not null,
  customer_ref text,
  channel text not null default 'storefront' check (length(trim(channel)) > 0),
  state text not null default 'pending' check (state in ('pending','confirmed','processing','fulfilled','cancelled')),
  payment_state text not null default 'pending' check (payment_state in ('pending','authorized','captured','declined','failed','reconciliation_required')),
  fulfillment_state text not null default 'unfulfilled' check (fulfillment_state in ('unfulfilled','blocked','processing','fulfilled','cancelled')),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  subtotal_minor bigint not null check (subtotal_minor >= 0),
  adjustment_minor bigint not null default 0,
  shipping_minor bigint not null default 0 check (shipping_minor >= 0),
  tax_minor bigint not null default 0 check (tax_minor >= 0),
  total_minor bigint not null check (total_minor >= 0),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commerce_orders_scope_check check (tenant_id = org_id),
  constraint commerce_orders_scope_identity unique (id, tenant_id, org_id),
  constraint commerce_orders_checkout_unique unique (checkout_id),
  constraint commerce_orders_storefront_fk foreign key (storefront_id, tenant_id, org_id)
    references public.commerce_storefronts(id, tenant_id, org_id) on delete restrict,
  constraint commerce_orders_checkout_fk foreign key (checkout_id, tenant_id, org_id)
    references public.commerce_checkout_sessions(id, tenant_id, org_id) on delete restrict
);

create table if not exists public.commerce_order_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  order_id uuid not null,
  product_id uuid,
  variant_id uuid,
  sku text not null,
  title text not null,
  quantity integer not null check (quantity > 0),
  unit_price_minor bigint not null check (unit_price_minor >= 0),
  line_total_minor bigint not null check (line_total_minor >= 0),
  created_at timestamptz not null default now(),
  constraint commerce_order_lines_scope_check check (tenant_id = org_id),
  constraint commerce_order_lines_order_fk foreign key (order_id, tenant_id, org_id)
    references public.commerce_orders(id, tenant_id, org_id) on delete cascade
);

create table if not exists public.commerce_order_adjustments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  order_id uuid not null,
  code text not null,
  source text not null,
  amount_minor bigint not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint commerce_order_adjustments_scope_check check (tenant_id = org_id),
  constraint commerce_order_adjustments_order_fk foreign key (order_id, tenant_id, org_id)
    references public.commerce_orders(id, tenant_id, org_id) on delete cascade
);

create table if not exists public.commerce_order_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  order_id uuid not null,
  provider text not null check (length(trim(provider)) > 0),
  provider_reference text,
  state text not null check (state in ('pending','authorized','captured','declined','failed','reconciliation_required')),
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  provider_recorded_at timestamptz,
  safe_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint commerce_order_payments_scope_check check (tenant_id = org_id),
  constraint commerce_order_payments_order_fk foreign key (order_id, tenant_id, org_id)
    references public.commerce_orders(id, tenant_id, org_id) on delete cascade
);

create table if not exists public.commerce_order_status_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  order_id uuid not null,
  previous_state text,
  resulting_state text not null,
  actor_user_id uuid,
  reason_code text,
  created_at timestamptz not null default now(),
  constraint commerce_order_status_history_scope_check check (tenant_id = org_id),
  constraint commerce_order_status_history_order_fk foreign key (order_id, tenant_id, org_id)
    references public.commerce_orders(id, tenant_id, org_id) on delete cascade
);

create table if not exists public.commerce_idempotency_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  channel text not null check (length(trim(channel)) > 0),
  idempotency_key text not null check (length(trim(idempotency_key)) > 0),
  request_fingerprint text not null check (length(trim(request_fingerprint)) > 0),
  status text not null default 'started' check (status in ('started','completed','failed')),
  order_id uuid,
  response_payload jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint commerce_idempotency_keys_scope_check check (tenant_id = org_id),
  constraint commerce_idempotency_order_fk foreign key (order_id, tenant_id, org_id)
    references public.commerce_orders(id, tenant_id, org_id) on delete restrict
);

create table if not exists public.commerce_outbox_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  aggregate_type text not null,
  aggregate_id uuid not null,
  event_type text not null,
  event_version integer not null default 1 check (event_version > 0),
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','processing','delivered','partial','failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  available_at timestamptz not null default now(),
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  constraint commerce_outbox_events_scope_check check (tenant_id = org_id),
  constraint commerce_outbox_events_scope_identity unique (id, tenant_id, org_id)
);

create table if not exists public.commerce_integration_deliveries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null,
  target_module text not null check (length(trim(target_module)) > 0),
  status text not null default 'pending' check (status in ('pending','processing','delivered','blocked','failed')),
  adapter_reference text,
  reason_code text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_attempt_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commerce_integration_deliveries_scope_check check (tenant_id = org_id),
  constraint commerce_integration_deliveries_event_fk foreign key (event_id, tenant_id, org_id)
    references public.commerce_outbox_events(id, tenant_id, org_id) on delete cascade
);

create table if not exists public.commerce_integration_exceptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.organizations(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  event_id uuid not null,
  delivery_id uuid,
  target_module text not null,
  reason_code text not null,
  safe_details jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open','acknowledged','resolved')),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint commerce_integration_exceptions_scope_check check (tenant_id = org_id),
  constraint commerce_integration_exceptions_event_fk foreign key (event_id, tenant_id, org_id)
    references public.commerce_outbox_events(id, tenant_id, org_id) on delete cascade
);

create unique index if not exists commerce_idempotency_scope_key_idx
  on public.commerce_idempotency_keys (tenant_id, org_id, channel, idempotency_key);

create unique index if not exists commerce_delivery_once_idx
  on public.commerce_integration_deliveries (event_id, target_module);

create index if not exists commerce_products_storefront_state_idx
  on public.commerce_products (storefront_id, state, created_at desc);
create index if not exists commerce_orders_org_created_idx
  on public.commerce_orders (org_id, created_at desc);
create index if not exists commerce_outbox_pending_idx
  on public.commerce_outbox_events (status, available_at, created_at)
  where status in ('pending','failed');
create index if not exists commerce_exceptions_open_idx
  on public.commerce_integration_exceptions (org_id, status, created_at desc)
  where status <> 'resolved';

create or replace function public.commerce_has_active_membership(p_org_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.org_id = p_org_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  );
$$;

revoke all on function public.commerce_has_active_membership(uuid) from public, anon;
grant execute on function public.commerce_has_active_membership(uuid) to authenticated;

alter table public.commerce_storefronts enable row level security;
alter table public.commerce_products enable row level security;
alter table public.commerce_product_variants enable row level security;
alter table public.commerce_product_media enable row level security;
alter table public.commerce_carts enable row level security;
alter table public.commerce_cart_lines enable row level security;
alter table public.commerce_checkout_sessions enable row level security;
alter table public.commerce_orders enable row level security;
alter table public.commerce_order_lines enable row level security;
alter table public.commerce_order_adjustments enable row level security;
alter table public.commerce_order_payments enable row level security;
alter table public.commerce_order_status_history enable row level security;
alter table public.commerce_idempotency_keys enable row level security;
alter table public.commerce_outbox_events enable row level security;
alter table public.commerce_integration_deliveries enable row level security;
alter table public.commerce_integration_exceptions enable row level security;

create policy commerce_storefronts_member_read on public.commerce_storefronts
  for select to authenticated using (public.commerce_has_active_membership(org_id));
create policy commerce_products_member_read on public.commerce_products
  for select to authenticated using (public.commerce_has_active_membership(org_id));
create policy commerce_product_variants_member_read on public.commerce_product_variants
  for select to authenticated using (public.commerce_has_active_membership(org_id));
create policy commerce_product_media_member_read on public.commerce_product_media
  for select to authenticated using (public.commerce_has_active_membership(org_id));
create policy commerce_carts_member_read on public.commerce_carts
  for select to authenticated using (public.commerce_has_active_membership(org_id));
create policy commerce_cart_lines_member_read on public.commerce_cart_lines
  for select to authenticated using (public.commerce_has_active_membership(org_id));
create policy commerce_checkout_sessions_member_read on public.commerce_checkout_sessions
  for select to authenticated using (public.commerce_has_active_membership(org_id));
create policy commerce_orders_member_read on public.commerce_orders
  for select to authenticated using (public.commerce_has_active_membership(org_id));
create policy commerce_order_lines_member_read on public.commerce_order_lines
  for select to authenticated using (public.commerce_has_active_membership(org_id));
create policy commerce_order_adjustments_member_read on public.commerce_order_adjustments
  for select to authenticated using (public.commerce_has_active_membership(org_id));
create policy commerce_order_payments_member_read on public.commerce_order_payments
  for select to authenticated using (public.commerce_has_active_membership(org_id));
create policy commerce_order_status_history_member_read on public.commerce_order_status_history
  for select to authenticated using (public.commerce_has_active_membership(org_id));
create policy commerce_idempotency_keys_member_read on public.commerce_idempotency_keys
  for select to authenticated using (public.commerce_has_active_membership(org_id));
create policy commerce_outbox_events_member_read on public.commerce_outbox_events
  for select to authenticated using (public.commerce_has_active_membership(org_id));
create policy commerce_integration_deliveries_member_read on public.commerce_integration_deliveries
  for select to authenticated using (public.commerce_has_active_membership(org_id));
create policy commerce_integration_exceptions_member_read on public.commerce_integration_exceptions
  for select to authenticated using (public.commerce_has_active_membership(org_id));

revoke all on public.commerce_storefronts from anon, authenticated;
revoke all on public.commerce_products from anon, authenticated;
revoke all on public.commerce_product_variants from anon, authenticated;
revoke all on public.commerce_product_media from anon, authenticated;
revoke all on public.commerce_carts from anon, authenticated;
revoke all on public.commerce_cart_lines from anon, authenticated;
revoke all on public.commerce_checkout_sessions from anon, authenticated;

revoke all on public.commerce_orders from anon;
revoke all on public.commerce_orders from authenticated;
revoke all on public.commerce_order_lines from anon, authenticated;
revoke all on public.commerce_order_adjustments from anon, authenticated;
revoke all on public.commerce_order_payments from anon;
revoke all on public.commerce_order_payments from authenticated;
revoke all on public.commerce_order_status_history from anon, authenticated;
revoke all on public.commerce_idempotency_keys from anon;
revoke all on public.commerce_idempotency_keys from authenticated;
revoke all on public.commerce_outbox_events from anon;
revoke all on public.commerce_outbox_events from authenticated;
revoke all on public.commerce_integration_deliveries from anon;
revoke all on public.commerce_integration_deliveries from authenticated;
revoke all on public.commerce_integration_exceptions from anon;
revoke all on public.commerce_integration_exceptions from authenticated;

grant select on public.commerce_storefronts to authenticated;
grant select on public.commerce_products to authenticated;
grant select on public.commerce_product_variants to authenticated;
grant select on public.commerce_product_media to authenticated;
grant select on public.commerce_carts to authenticated;
grant select on public.commerce_cart_lines to authenticated;
grant select on public.commerce_checkout_sessions to authenticated;
grant select on public.commerce_orders to authenticated;
grant select on public.commerce_order_lines to authenticated;
grant select on public.commerce_order_adjustments to authenticated;
grant select on public.commerce_order_payments to authenticated;
grant select on public.commerce_order_status_history to authenticated;
grant select on public.commerce_idempotency_keys to authenticated;
grant select on public.commerce_outbox_events to authenticated;
grant select on public.commerce_integration_deliveries to authenticated;
grant select on public.commerce_integration_exceptions to authenticated;

comment on table public.commerce_product_media is
  'References existing ATLAS Library/Creator assets; Commerce does not duplicate media binaries.';
comment on table public.commerce_outbox_events is
  'Durable Commerce integration outbox. Provider/module success is never inferred from event creation.';
comment on table public.commerce_integration_deliveries is
  'Per-target durable delivery state for Commerce events, including explicit blocked/unavailable adapters.';
