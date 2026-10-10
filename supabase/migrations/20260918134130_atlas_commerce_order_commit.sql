create or replace function public.commerce_commit_order(
  p_tenant_id uuid,
  p_org_id uuid,
  p_storefront_id uuid,
  p_checkout_id uuid,
  p_customer_ref text,
  p_channel text,
  p_currency text,
  p_subtotal_minor bigint,
  p_adjustment_minor bigint,
  p_shipping_minor bigint,
  p_tax_minor bigint,
  p_total_minor bigint,
  p_payment_state text,
  p_payment_provider text,
  p_payment_provider_reference text,
  p_payment_recorded_at timestamptz,
  p_lines jsonb,
  p_adjustments jsonb,
  p_idempotency_key text,
  p_request_fingerprint text
)
returns table (
  order_id uuid,
  idempotent_replay boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_idempotency public.commerce_idempotency_keys%rowtype;
  v_inserted_idempotency uuid;
  v_order_id uuid;
  v_event_id uuid;
begin
  if p_tenant_id is null or p_org_id is null or p_tenant_id <> p_org_id then
    raise exception 'SCOPE_MISMATCH';
  end if;

  if p_total_minor < 0
     or p_subtotal_minor < 0
     or p_shipping_minor < 0
     or p_tax_minor < 0 then
    raise exception 'INVALID_MONEY';
  end if;

  if length(trim(coalesce(p_idempotency_key, ''))) = 0
     or length(trim(coalesce(p_request_fingerprint, ''))) = 0 then
    raise exception 'IDEMPOTENCY_REQUIRED';
  end if;

  if p_total_minor > 0 and (
    p_payment_state not in ('authorized','captured')
    or length(trim(coalesce(p_payment_provider, ''))) = 0
    or length(trim(coalesce(p_payment_provider_reference, ''))) = 0
  ) then
    raise exception 'PAYMENT_NOT_AUTHORIZED';
  end if;

  insert into public.commerce_idempotency_keys (
    tenant_id,
    org_id,
    channel,
    idempotency_key,
    request_fingerprint,
    status
  ) values (
    p_tenant_id,
    p_org_id,
    trim(p_channel),
    trim(p_idempotency_key),
    p_request_fingerprint,
    'started'
  )
  on conflict (tenant_id, org_id, channel, idempotency_key) do nothing
  returning id into v_inserted_idempotency;

  select *
  into v_idempotency
  from public.commerce_idempotency_keys
  where tenant_id = p_tenant_id
    and org_id = p_org_id
    and channel = trim(p_channel)
    and idempotency_key = trim(p_idempotency_key)
  for update;

  if v_idempotency.request_fingerprint <> p_request_fingerprint then
    raise exception 'IDEMPOTENCY_CONFLICT';
  end if;

  if v_inserted_idempotency is null and v_idempotency.status = 'completed' then
    if v_idempotency.order_id is null then
      raise exception 'IDEMPOTENCY_RESULT_INVALID';
    end if;
    return query select v_idempotency.order_id, true;
    return;
  end if;

  if v_inserted_idempotency is null and v_idempotency.status = 'started' then
    raise exception 'IDEMPOTENCY_IN_PROGRESS';
  end if;

  if v_inserted_idempotency is null and v_idempotency.status = 'failed' then
    update public.commerce_idempotency_keys
    set status = 'started',
        response_payload = null,
        completed_at = null
    where id = v_idempotency.id;
  end if;

  insert into public.commerce_orders (
    tenant_id,
    org_id,
    storefront_id,
    checkout_id,
    customer_ref,
    channel,
    state,
    payment_state,
    fulfillment_state,
    currency,
    subtotal_minor,
    adjustment_minor,
    shipping_minor,
    tax_minor,
    total_minor,
    confirmed_at
  ) values (
    p_tenant_id,
    p_org_id,
    p_storefront_id,
    p_checkout_id,
    nullif(trim(coalesce(p_customer_ref, '')), ''),
    trim(p_channel),
    'confirmed',
    case when p_total_minor = 0 then 'captured' else p_payment_state end,
    'unfulfilled',
    upper(trim(p_currency)),
    p_subtotal_minor,
    p_adjustment_minor,
    p_shipping_minor,
    p_tax_minor,
    p_total_minor,
    now()
  )
  returning id into v_order_id;

  insert into public.commerce_order_lines (
    tenant_id,
    org_id,
    order_id,
    product_id,
    variant_id,
    sku,
    title,
    quantity,
    unit_price_minor,
    line_total_minor
  )
  select
    p_tenant_id,
    p_org_id,
    v_order_id,
    nullif(line_item->>'productId', '')::uuid,
    nullif(line_item->>'variantId', '')::uuid,
    trim(line_item->>'sku'),
    trim(line_item->>'title'),
    (line_item->>'quantity')::integer,
    (line_item->>'unitPriceMinor')::bigint,
    (line_item->>'lineTotalMinor')::bigint
  from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) as line_item;

  insert into public.commerce_order_adjustments (
    tenant_id,
    org_id,
    order_id,
    code,
    source,
    amount_minor,
    metadata
  )
  select
    p_tenant_id,
    p_org_id,
    v_order_id,
    trim(adjustment->>'code'),
    trim(adjustment->>'source'),
    (adjustment->>'amountMinor')::bigint,
    coalesce(adjustment->'metadata', '{}'::jsonb)
  from jsonb_array_elements(coalesce(p_adjustments, '[]'::jsonb)) as adjustment;

  if p_total_minor > 0 then
    insert into public.commerce_order_payments (
      tenant_id,
      org_id,
      order_id,
      provider,
      provider_reference,
      state,
      amount_minor,
      currency,
      provider_recorded_at
    ) values (
      p_tenant_id,
      p_org_id,
      v_order_id,
      trim(p_payment_provider),
      trim(p_payment_provider_reference),
      p_payment_state,
      p_total_minor,
      upper(trim(p_currency)),
      coalesce(p_payment_recorded_at, now())
    );
  end if;

  insert into public.commerce_order_status_history (
    tenant_id,
    org_id,
    order_id,
    previous_state,
    resulting_state,
    reason_code
  ) values (
    p_tenant_id,
    p_org_id,
    v_order_id,
    null,
    'confirmed',
    'checkout_completed'
  );

  insert into public.commerce_outbox_events (
    tenant_id,
    org_id,
    aggregate_type,
    aggregate_id,
    event_type,
    event_version,
    payload,
    status
  ) values (
    p_tenant_id,
    p_org_id,
    'commerce_order',
    v_order_id,
    'commerce.order.completed.v1',
    1,
    jsonb_build_object(
      'orderId', v_order_id,
      'storefrontId', p_storefront_id,
      'checkoutId', p_checkout_id,
      'channel', trim(p_channel),
      'currency', upper(trim(p_currency)),
      'totalMinor', p_total_minor
    ),
    'pending'
  )
  returning id into v_event_id;

  update public.commerce_idempotency_keys
  set status = 'completed',
      order_id = v_order_id,
      response_payload = jsonb_build_object(
        'orderId', v_order_id,
        'eventId', v_event_id
      ),
      completed_at = now()
  where tenant_id = p_tenant_id
    and org_id = p_org_id
    and channel = trim(p_channel)
    and idempotency_key = trim(p_idempotency_key);

  update public.commerce_carts
  set state = 'converted',
      updated_at = now()
  where id = (
    select cart_id
    from public.commerce_checkout_sessions
    where id = p_checkout_id
      and tenant_id = p_tenant_id
      and org_id = p_org_id
  )
    and tenant_id = p_tenant_id
    and org_id = p_org_id
    and state = 'active';

  update public.commerce_checkout_sessions
  set state = 'completed',
      updated_at = now()
  where id = p_checkout_id
    and tenant_id = p_tenant_id
    and org_id = p_org_id;

  return query select v_order_id, false;
end;
$$;

revoke all on function public.commerce_commit_order(
  uuid,uuid,uuid,uuid,text,text,text,bigint,bigint,bigint,bigint,bigint,
  text,text,text,timestamptz,jsonb,jsonb,text,text
) from public, anon, authenticated;

grant execute on function public.commerce_commit_order(
  uuid,uuid,uuid,uuid,text,text,text,bigint,bigint,bigint,bigint,bigint,
  text,text,text,timestamptz,jsonb,jsonb,text,text
) to service_role;

comment on function public.commerce_commit_order(
  uuid,uuid,uuid,uuid,text,text,text,bigint,bigint,bigint,bigint,bigint,
  text,text,text,timestamptz,jsonb,jsonb,text,text
) is 'Atomically commits a Commerce order, payment fact, history, idempotency result and commerce.order.completed.v1 outbox event.';
