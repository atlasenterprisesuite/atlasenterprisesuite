import {
  authorizedAtlasFetch,
  getActiveAtlasOrganization
} from '../../lib/atlasSession';

export type CommerceApiOperation =
  | 'catalog.list'
  | 'catalog.upsert'
  | 'orders.list'
  | 'orders.get'
  | 'checkout.prepare'
  | 'checkout.submit';

export class CommerceApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(input: { message: string; status: number; code?: string | null }) {
    super(input.message);
    this.name = 'CommerceApiError';
    this.status = input.status;
    this.code = input.code ?? null;
  }
}

async function parseBody(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

export async function commerceApi<T = Record<string, unknown>>(
  operation: CommerceApiOperation,
  payload: Record<string, unknown> = {}
): Promise<T> {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch('/functions/v1/atlas-commerce', {
    method: 'POST',
    body: JSON.stringify({
      operation,
      organizationId: organization.id,
      ...payload
    })
  });

  const body = await parseBody(response);
  if (!response.ok) {
    const code = typeof body.code === 'string'
      ? body.code
      : typeof body.error === 'string'
        ? body.error
        : null;
    throw new CommerceApiError({
      message: code || `Commerce request failed (${response.status})`,
      status: response.status,
      code
    });
  }

  return body as T;
}


const PUBLIC_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://ggmanzcgtlrvqfoccgsh.supabase.co';
const PUBLIC_SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_wicVjdsduxa5FAnRW9k0Lw_HxtBW72d';

export type PublicCommerceApiOperation = 'storefront.catalog' | 'storefront.product';

export async function publicCommerceApi<T = Record<string, unknown>>(
  operation: PublicCommerceApiOperation,
  payload: Record<string, unknown>
): Promise<T> {
  const response = await fetch(`${PUBLIC_SUPABASE_URL}/functions/v1/atlas-commerce`, {
    method: 'POST',
    headers: {
      apikey: PUBLIC_SUPABASE_KEY,
      'content-type': 'application/json'
    },
    body: JSON.stringify({ operation, ...payload })
  });

  const body = await parseBody(response);
  if (!response.ok) {
    const code = typeof body.code === 'string'
      ? body.code
      : typeof body.error === 'string'
        ? body.error
        : null;
    throw new CommerceApiError({
      message: code || `Commerce request failed (${response.status})`,
      status: response.status,
      code
    });
  }

  return body as T;
}
