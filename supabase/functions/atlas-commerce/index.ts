import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
import {
  AuthorizeNetPaymentAdapter,
  CommercePaymentError,
  UnavailablePaymentAdapter,
  canonicalCheckoutFingerprint,
  evaluatePaymentResult,
  priceCart,
  type NormalizedPaymentResult
} from '../../../packages/commerce/src/index.ts';
import { getServerSecret } from '../_shared/server-secret-store.ts';
import {
  commercePermissionsForRole,
  isPublicCommerceOperation,
  requiredCommercePermissionForOperation,
  type CommerceApiOperation,
  type CommercePermission,
  type WorkspaceCommerceOperation
} from './operations.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const PUBLISHABLE_KEY =
  Deno.env.get('SUPABASE_ANON_KEY') ||
  Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ||
  '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const ALLOW_ZERO_TOTAL_ORDERS =
  Deno.env.get('ATLAS_COMMERCE_ALLOW_ZERO_TOTAL_ORDERS') === 'true';
const AUTHORIZE_NET_ECHECK_ENABLED =
  Deno.env.get('ATLAS_AUTHORIZE_NET_ECHECK_ENABLED') === 'true';
const AUTHORIZE_NET_ENVIRONMENT =
  Deno.env.get('ATLAS_AUTHORIZE_NET_ENVIRONMENT') === 'production'
    ? 'production'
    : 'sandbox';
const AUTHORIZE_NET_CURRENCY =
  (Deno.env.get('ATLAS_AUTHORIZE_NET_CURRENCY') || 'USD').toUpperCase();
const MAX_REQUEST_BYTES = 64 * 1024;

const ALLOWED_ORIGINS = new Set([
  'https://atlasenterprisesuite.com',
  'https://www.atlasenterprisesuite.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
]);

type JsonObject = Record<string, unknown>;

type CommerceContext = {
  userId: string;
  orgId: string;
  tenantId: string;
  role: string;
  permissions: CommercePermission[];
};

class EdgeError extends Error {
  constructor(readonly code: string, readonly status: number) {
    super(code);
    this.name = 'EdgeError';
  }
}

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  return {
    'access-control-allow-origin': ALLOWED_ORIGINS.has(origin)
      ? origin
      : 'https://www.atlasenterprisesuite.com',
    'access-control-allow-headers': 'authorization, apikey, content-type, x-request-id',
    'access-control-allow-methods': 'POST, OPTIONS',
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'vary': 'Origin',
    'x-content-type-options': 'nosniff'
  };
}

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(req)
  });
}

function clean(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function requiredText(value: unknown, code: string, max = 500) {
  const result = clean(value, max);
  if (!result) throw new EdgeError(code, 422);
  return result;
}

function userClient(req: Request) {
  if (!SUPABASE_URL || !PUBLISHABLE_KEY) {
    throw new EdgeError('supabase_runtime_not_configured', 503);
  }
  return createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: req.headers.get('authorization') || '' }
    }
  });
}

function adminClient() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new EdgeError('server_runtime_not_configured', 503);
  }
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function configuredPaymentAdapter() {
  if (!AUTHORIZE_NET_ECHECK_ENABLED) {
    return new UnavailablePaymentAdapter();
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new UnavailablePaymentAdapter();
  }

  const [apiLoginId, transactionKey] = await Promise.all([
    getServerSecret({
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SERVICE_ROLE_KEY,
      name: 'authorize_net_api_login_id'
    }),
    getServerSecret({
      supabaseUrl: SUPABASE_URL,
      serviceRoleKey: SERVICE_ROLE_KEY,
      name: 'authorize_net_transaction_key'
    })
  ]);

  if (!apiLoginId || !transactionKey) {
    return new UnavailablePaymentAdapter();
  }

  return new AuthorizeNetPaymentAdapter({
    apiLoginId,
    transactionKey,
    environment: AUTHORIZE_NET_ENVIRONMENT,
    currency: AUTHORIZE_NET_CURRENCY
  });
}

async function resolveContext(
  req: Request,
  requestedOrganizationId: string
): Promise<CommerceContext> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new EdgeError('authentication_required', 401);

  const sb = userClient(req);
  const { data: authData, error: authError } = await sb.auth.getUser(token);
  if (authError || !authData.user) {
    throw new EdgeError('invalid_session', 401);
  }

  let membershipQuery = sb
    .from('organization_members')
    .select('org_id,role,status')
    .eq('user_id', authData.user.id)
    .eq('status', 'active');

  if (requestedOrganizationId) {
    membershipQuery = membershipQuery.eq('org_id', requestedOrganizationId);
  }

  const { data: memberships, error: membershipError } =
    await membershipQuery.limit(1);
  const membership = memberships?.[0];
  if (membershipError || !membership?.org_id) {
    throw new EdgeError('membership_required', 403);
  }

  const orgId = String(membership.org_id);
  const role = String(membership.role || 'member');

  return {
    userId: authData.user.id,
    orgId,
    tenantId: orgId,
    role,
    permissions: commercePermissionsForRole(role)
  };
}

function requirePermission(
  context: CommerceContext,
  permission: CommercePermission
) {
  if (
    !context.permissions.includes(permission) &&
    !context.permissions.includes('commerce.admin')
  ) {
    throw new EdgeError('permission_required', 403);
  }
}

function normalizedOperation(value: unknown): CommerceApiOperation {
  const operation = clean(value, 80) as CommerceApiOperation;
  const allowed = new Set<CommerceApiOperation>([
    'catalog.list',
    'catalog.upsert',
    'orders.list',
    'orders.get',
    'checkout.prepare',
    'checkout.submit',
    'storefront.catalog',
    'storefront.product'
  ]);
  if (!allowed.has(operation)) throw new EdgeError('unsupported_operation', 404);
  return operation;
}

function safeMoney(value: bigint) {
  return value.toString();
}

function serializePrice(result: ReturnType<typeof priceCart>) {
  return {
    currency: result.currency,
    subtotalMinor: safeMoney(result.subtotalMinor),
    adjustmentMinor: safeMoney(result.adjustmentMinor),
    shippingMinor: safeMoney(result.shippingMinor),
    taxMinor: safeMoney(result.taxMinor),
    totalMinor: safeMoney(result.totalMinor)
  };
}

async function publishedStorefront(admin: ReturnType<typeof createClient>, slug: string) {
  const { data, error } = await admin
    .from('commerce_storefronts')
    .select('id,slug,name,currency,status')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();

  if (error) throw new EdgeError('persistence_error', 500);
  if (!data) throw new EdgeError('storefront_not_found', 404);
  return data;
}

async function publicCatalog(
  req: Request,
  body: JsonObject,
  operation: 'storefront.catalog' | 'storefront.product'
) {
  const admin = adminClient();
  const storefrontSlug = requiredText(
    body.storefrontSlug ?? body.storefront_slug,
    'storefront_slug_required',
    120
  );
  const storefront = await publishedStorefront(admin, storefrontSlug);

  let productsQuery = admin
    .from('commerce_products')
    .select('id,storefront_id,title,slug,description,state')
    .eq('storefront_id', storefront.id)
    .eq('state', 'published')
    .order('title', { ascending: true });

  if (operation === 'storefront.product') {
    const productSlug = requiredText(
      body.productSlug ?? body.product_slug,
      'product_slug_required',
      160
    );
    productsQuery = productsQuery.eq('slug', productSlug);
  }

  const { data: products, error: productsError } = await productsQuery;
  if (productsError) throw new EdgeError('persistence_error', 500);

  if (operation === 'storefront.product' && (products || []).length === 0) {
    throw new EdgeError('product_not_found', 404);
  }

  const productIds = (products || []).map((product: any) => String(product.id));
  if (productIds.length === 0) {
    return json(req, { ok: true, storefront, products: [] });
  }

  const [{ data: variants, error: variantError }, { data: media, error: mediaError }] =
    await Promise.all([
      admin
        .from('commerce_product_variants')
        .select('id,product_id,sku,title,currency,price_minor,state')
        .in('product_id', productIds)
        .eq('state', 'published')
        .order('sku', { ascending: true }),
      admin
        .from('commerce_product_media')
        .select('id,product_id,variant_id,asset_source,asset_id,media_type,alt_text,sort_order')
        .in('product_id', productIds)
        .order('sort_order', { ascending: true })
    ]);

  if (variantError || mediaError) throw new EdgeError('persistence_error', 500);

  const hydrated = (products || []).map((product: any) => ({
    ...product,
    variants: (variants || []).filter((variant: any) => variant.product_id === product.id),
    media: (media || []).filter((item: any) => item.product_id === product.id)
  }));

  return json(req, {
    ok: true,
    storefront,
    ...(operation === 'storefront.product'
      ? { product: hydrated[0] }
      : { products: hydrated })
  });
}

async function serverPrice(
  admin: ReturnType<typeof createClient>,
  context: CommerceContext,
  body: JsonObject
) {
  const rawLines = Array.isArray(body.lines) ? body.lines : [];
  if (rawLines.length === 0 || rawLines.length > 100) {
    throw new EdgeError('checkout_lines_required', 422);
  }
  if (Array.isArray(body.adjustments) && body.adjustments.length > 0) {
    throw new EdgeError('promotions_unavailable', 409);
  }

  const requested = rawLines.map((raw: any) => {
    const variantId = requiredText(raw?.variantId ?? raw?.variant_id, 'variant_id_required', 80);
    const quantity = Number(raw?.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 1000) {
      throw new EdgeError('invalid_quantity', 422);
    }
    return { variantId, quantity };
  });

  const variantIds = [...new Set(requested.map((line) => line.variantId))];
  const { data: variants, error } = await admin
    .from('commerce_product_variants')
    .select('id,product_id,sku,title,currency,price_minor,state')
    .eq('tenant_id', context.tenantId)
    .eq('org_id', context.orgId)
    .in('id', variantIds)
    .eq('state', 'published');

  if (error) throw new EdgeError('persistence_error', 500);
  if ((variants || []).length !== variantIds.length) {
    throw new EdgeError('variant_unavailable', 409);
  }

  const byId = new Map((variants || []).map((variant: any) => [String(variant.id), variant]));
  const currencies = new Set((variants || []).map((variant: any) => String(variant.currency)));
  if (currencies.size !== 1) throw new EdgeError('currency_mismatch', 409);
  const currency = String((variants || [])[0].currency);

  const lines = requested.map((line) => {
    const variant: any = byId.get(line.variantId);
    const unitPriceMinor = BigInt(String(variant.price_minor));
    return {
      productId: String(variant.product_id),
      variantId: line.variantId,
      sku: String(variant.sku),
      title: String(variant.title),
      quantity: line.quantity,
      unitPriceMinor,
      lineTotalMinor: unitPriceMinor * BigInt(line.quantity)
    };
  });

  const priced = priceCart({
    currency,
    lines: lines.map((line) => ({
      variantId: line.variantId,
      quantity: line.quantity,
      unitPriceMinor: line.unitPriceMinor
    })),
    adjustments: [],
    shippingMinor: 0n,
    taxMinor: 0n
  });

  return { priced, lines };
}

async function catalogList(
  req: Request,
  admin: ReturnType<typeof createClient>,
  context: CommerceContext
) {
  const { data, error } = await admin
    .from('commerce_products')
    .select('id,storefront_id,title,slug,description,state,published_at,created_at,updated_at')
    .eq('tenant_id', context.tenantId)
    .eq('org_id', context.orgId)
    .order('title', { ascending: true });

  if (error) throw new EdgeError('persistence_error', 500);
  return json(req, { ok: true, products: data || [] });
}

async function catalogUpsert(
  req: Request,
  admin: ReturnType<typeof createClient>,
  context: CommerceContext,
  body: JsonObject
) {
  const product =
    body.product && typeof body.product === 'object' && !Array.isArray(body.product)
      ? body.product as JsonObject
      : body;

  const id = clean(product.id, 80);
  const storefrontId = requiredText(
    product.storefrontId ?? product.storefront_id,
    'storefront_id_required',
    80
  );
  const title = requiredText(product.title, 'title_required', 240);
  const slug = requiredText(product.slug, 'slug_required', 180);
  const state = clean(product.state, 20) || 'draft';
  if (!['draft', 'published', 'archived'].includes(state)) {
    throw new EdgeError('invalid_product_state', 422);
  }

  const { data: storefront, error: storefrontError } = await admin
    .from('commerce_storefronts')
    .select('id')
    .eq('id', storefrontId)
    .eq('tenant_id', context.tenantId)
    .eq('org_id', context.orgId)
    .maybeSingle();
  if (storefrontError) throw new EdgeError('persistence_error', 500);
  if (!storefront) throw new EdgeError('storefront_not_found', 404);

  const values = {
    tenant_id: context.tenantId,
    org_id: context.orgId,
    storefront_id: storefrontId,
    title,
    slug,
    description: clean(product.description, 5000) || null,
    state,
    published_at: state === 'published' ? new Date().toISOString() : null,
    updated_at: new Date().toISOString()
  };

  const query = id
    ? admin
        .from('commerce_products')
        .update(values)
        .eq('id', id)
        .eq('tenant_id', context.tenantId)
        .eq('org_id', context.orgId)
    : admin.from('commerce_products').insert(values);

  const { data, error } = await query
    .select('id,storefront_id,title,slug,description,state,published_at,created_at,updated_at')
    .single();

  if (error) throw new EdgeError('persistence_error', 500);
  return json(req, { ok: true, product: data });
}

async function ordersList(
  req: Request,
  admin: ReturnType<typeof createClient>,
  context: CommerceContext
) {
  const { data, error } = await admin
    .from('commerce_orders')
    .select('id,storefront_id,customer_ref,channel,state,payment_state,fulfillment_state,currency,total_minor,confirmed_at,created_at,updated_at')
    .eq('tenant_id', context.tenantId)
    .eq('org_id', context.orgId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) throw new EdgeError('persistence_error', 500);
  return json(req, { ok: true, orders: data || [] });
}

async function orderGet(
  req: Request,
  admin: ReturnType<typeof createClient>,
  context: CommerceContext,
  body: JsonObject
) {
  const orderId = requiredText(body.orderId ?? body.order_id, 'order_id_required', 80);
  const { data: order, error: orderError } = await admin
    .from('commerce_orders')
    .select('*')
    .eq('id', orderId)
    .eq('tenant_id', context.tenantId)
    .eq('org_id', context.orgId)
    .maybeSingle();

  if (orderError) throw new EdgeError('persistence_error', 500);
  if (!order) throw new EdgeError('order_not_found', 404);

  const [lines, payments, history, events] = await Promise.all([
    admin.from('commerce_order_lines').select('*').eq('order_id', orderId).eq('org_id', context.orgId),
    admin.from('commerce_order_payments').select('*').eq('order_id', orderId).eq('org_id', context.orgId),
    admin.from('commerce_order_status_history').select('*').eq('order_id', orderId).eq('org_id', context.orgId).order('created_at'),
    admin.from('commerce_outbox_events').select('id,event_type,status,created_at').eq('aggregate_type', 'commerce_order').eq('aggregate_id', orderId).eq('org_id', context.orgId)
  ]);

  if (lines.error || payments.error || history.error || events.error) {
    throw new EdgeError('persistence_error', 500);
  }

  const eventIds = (events.data || []).map((event: any) => String(event.id));
  let deliveries: any[] = [];
  if (eventIds.length > 0) {
    const result = await admin
      .from('commerce_integration_deliveries')
      .select('event_id,target_module,status,reason_code,attempt_count,last_attempt_at,delivered_at')
      .eq('org_id', context.orgId)
      .in('event_id', eventIds);
    if (result.error) throw new EdgeError('persistence_error', 500);
    deliveries = result.data || [];
  }

  return json(req, {
    ok: true,
    order,
    lines: lines.data || [],
    payments: payments.data || [],
    history: history.data || [],
    events: events.data || [],
    deliveries
  });
}

async function checkoutPrepare(
  req: Request,
  admin: ReturnType<typeof createClient>,
  context: CommerceContext,
  body: JsonObject
) {
  const { priced, lines } = await serverPrice(admin, context, body);
  return json(req, {
    ok: true,
    pricing: serializePrice(priced),
    lines: lines.map((line) => ({
      variantId: line.variantId,
      sku: line.sku,
      title: line.title,
      quantity: line.quantity,
      unitPriceMinor: safeMoney(line.unitPriceMinor),
      lineTotalMinor: safeMoney(line.lineTotalMinor)
    })),
    paymentRequired: priced.totalMinor > 0n
  });
}

async function checkoutSubmit(
  req: Request,
  admin: ReturnType<typeof createClient>,
  context: CommerceContext,
  body: JsonObject
) {
  const storefrontId = requiredText(
    body.storefrontId ?? body.storefront_id,
    'storefront_id_required',
    80
  );
  const idempotencyKey = requiredText(
    body.idempotencyKey ?? body.idempotency_key,
    'idempotency_key_required',
    200
  );
  const channel = clean(body.channel, 40) || 'storefront';
  const customerRef = clean(body.customerRef ?? body.customer_ref, 240) || null;
  const { priced, lines } = await serverPrice(admin, context, body);

  const { data: storefront, error: storefrontError } = await admin
    .from('commerce_storefronts')
    .select('id')
    .eq('id', storefrontId)
    .eq('tenant_id', context.tenantId)
    .eq('org_id', context.orgId)
    .maybeSingle();
  if (storefrontError) throw new EdgeError('persistence_error', 500);
  if (!storefront) throw new EdgeError('storefront_not_found', 404);

  let paymentResult: NormalizedPaymentResult | null = null;

  if (priced.totalMinor > 0n) {
    const adapter = await configuredPaymentAdapter();
    try {
      paymentResult = await adapter.authorize({
        amountMinor: priced.totalMinor,
        currency: priced.currency,
        paymentMethodReference: requiredText(
          body.paymentMethodReference ?? body.payment_method_reference,
          'payment_method_reference_required',
          4096
        ),
        idempotencyKey
      });
    } catch (error) {
      if (error instanceof CommercePaymentError) {
        if (error.code === 'PAYMENT_PROVIDER_UNAVAILABLE') {
          throw new EdgeError('PAYMENT_PROVIDER_UNAVAILABLE', 503);
        }
        if (
          error.code === 'PAYMENT_METHOD_REFERENCE_INVALID' ||
          error.code === 'PAYMENT_CURRENCY_UNSUPPORTED' ||
          error.code === 'PAYMENT_AMOUNT_INVALID'
        ) {
          throw new EdgeError(error.code, 422);
        }
        if (error.code === 'PAYMENT_FAILED') {
          throw new EdgeError('PAYMENT_FAILED', 502);
        }
      }
      throw new EdgeError('PAYMENT_RESULT_AMBIGUOUS', 502);
    }

    const evaluation = evaluatePaymentResult(paymentResult);
    if (!evaluation.accepted) {
      const status = evaluation.code === 'PAYMENT_DECLINED' ? 402 : 502;
      throw new EdgeError(evaluation.code, status);
    }
  }

  if (priced.totalMinor === 0n && !ALLOW_ZERO_TOTAL_ORDERS) {
    throw new EdgeError('ZERO_TOTAL_ORDER_DISABLED', 409);
  }

  const fingerprint = canonicalCheckoutFingerprint({
    storefrontId,
    customerRef,
    channel,
    currency: priced.currency,
    lines: lines.map((line) => ({
      variantId: line.variantId,
      sku: line.sku,
      quantity: line.quantity,
      unitPriceMinor: line.unitPriceMinor
    })),
    adjustments: [],
    shippingMinor: priced.shippingMinor,
    taxMinor: priced.taxMinor,
    totalMinor: priced.totalMinor
  });

  const { data: cart, error: cartError } = await admin
    .from('commerce_carts')
    .insert({
      tenant_id: context.tenantId,
      org_id: context.orgId,
      storefront_id: storefrontId,
      customer_ref: customerRef,
      currency: priced.currency,
      state: 'active'
    })
    .select('id')
    .single();
  if (cartError || !cart) throw new EdgeError('persistence_error', 500);

  const { error: lineError } = await admin.from('commerce_cart_lines').insert(
    lines.map((line) => ({
      tenant_id: context.tenantId,
      org_id: context.orgId,
      cart_id: cart.id,
      variant_id: line.variantId,
      quantity: line.quantity
    }))
  );
  if (lineError) throw new EdgeError('persistence_error', 500);

  const { data: checkout, error: checkoutError } = await admin
    .from('commerce_checkout_sessions')
    .insert({
      tenant_id: context.tenantId,
      org_id: context.orgId,
      cart_id: cart.id,
      state: 'payment_pending',
      currency: priced.currency,
      subtotal_minor: safeMoney(priced.subtotalMinor),
      adjustment_minor: safeMoney(priced.adjustmentMinor),
      shipping_minor: safeMoney(priced.shippingMinor),
      tax_minor: safeMoney(priced.taxMinor),
      total_minor: safeMoney(priced.totalMinor)
    })
    .select('id')
    .single();
  if (checkoutError || !checkout) throw new EdgeError('persistence_error', 500);

  const { data: committed, error: commitError } = await admin.rpc('commerce_commit_order', {
    p_tenant_id: context.tenantId,
    p_org_id: context.orgId,
    p_storefront_id: storefrontId,
    p_checkout_id: checkout.id,
    p_customer_ref: customerRef,
    p_channel: channel,
    p_currency: priced.currency,
    p_subtotal_minor: safeMoney(priced.subtotalMinor),
    p_adjustment_minor: safeMoney(priced.adjustmentMinor),
    p_shipping_minor: safeMoney(priced.shippingMinor),
    p_tax_minor: safeMoney(priced.taxMinor),
    p_total_minor: safeMoney(priced.totalMinor),
    p_payment_state: paymentResult?.state ?? 'captured',
    p_payment_provider: paymentResult?.provider ?? null,
    p_payment_provider_reference: paymentResult?.providerReference ?? null,
    p_payment_recorded_at: paymentResult?.recordedAt ?? null,
    p_lines: lines.map((line) => ({
      productId: line.productId,
      variantId: line.variantId,
      sku: line.sku,
      title: line.title,
      quantity: line.quantity,
      unitPriceMinor: line.unitPriceMinor.toString(),
      lineTotalMinor: line.lineTotalMinor.toString()
    })),
    p_adjustments: [],
    p_idempotency_key: idempotencyKey,
    p_request_fingerprint: fingerprint
  });

  if (commitError) {
    const message = String(commitError.message || '');
    if (message.includes('IDEMPOTENCY_CONFLICT')) {
      throw new EdgeError('IDEMPOTENCY_CONFLICT', 409);
    }
    throw new EdgeError('order_commit_failed', 500);
  }

  return json(req, {
    ok: true,
    order: Array.isArray(committed) ? committed[0] : committed,
    pricing: serializePrice(priced)
  }, 201);
}

async function workspaceOperation(
  req: Request,
  body: JsonObject,
  operation: WorkspaceCommerceOperation
) {
  const context = await resolveContext(
    req,
    clean(body.organizationId ?? body.organization_id, 80)
  );
  requirePermission(context, requiredCommercePermissionForOperation(operation));
  const admin = adminClient();

  switch (operation) {
    case 'catalog.list':
      return catalogList(req, admin, context);
    case 'catalog.upsert':
      return catalogUpsert(req, admin, context, body);
    case 'orders.list':
      return ordersList(req, admin, context);
    case 'orders.get':
      return orderGet(req, admin, context, body);
    case 'checkout.prepare':
      return checkoutPrepare(req, admin, context, body);
    case 'checkout.submit':
      return checkoutSubmit(req, admin, context, body);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  try {
    if (req.method !== 'POST') throw new EdgeError('method_not_allowed', 405);

    const declaredLength = Number(req.headers.get('content-length') || '0');
    if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
      throw new EdgeError('request_too_large', 413);
    }

    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_REQUEST_BYTES) {
      throw new EdgeError('request_too_large', 413);
    }

    let body: JsonObject;
    try {
      const parsed = raw ? JSON.parse(raw) : {};
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('invalid');
      }
      body = parsed as JsonObject;
    } catch {
      throw new EdgeError('invalid_json', 400);
    }

    const operation = normalizedOperation(body.operation);
    if (isPublicCommerceOperation(operation)) {
      return publicCatalog(req, body, operation);
    }

    return await workspaceOperation(req, body, operation);
  } catch (error) {
    if (error instanceof EdgeError) {
      return json(req, { ok: false, error: error.code, code: error.code }, error.status);
    }
    console.error('atlas-commerce unhandled error');
    return json(req, { ok: false, error: 'internal_error', code: 'internal_error' }, 500);
  }
});
