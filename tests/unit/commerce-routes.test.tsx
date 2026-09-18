import React from 'react';
import { readFileSync } from 'node:fs';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../apps/web/src/modules/commerce/commerceApi', () => ({
  commerceApi: vi.fn()
}));

import { AtlasShell } from '../../apps/web/src/components/AtlasShell';
import { CommerceRoutes } from '../../apps/web/src/modules/commerce/CommerceRoutes';
import { commerceApi } from '../../apps/web/src/modules/commerce/commerceApi';

const commerceApiMock = vi.mocked(commerceApi);
const resolverSource = readFileSync('apps/web/src/extensions/resolveAtlasExtension.tsx', 'utf8');

const product = {
  id: 'product-1',
  storefront_id: 'store-1',
  title: 'Atlas Field Kit',
  slug: 'atlas-field-kit',
  description: 'Field operations kit',
  state: 'published',
  published_at: '2026-09-18T10:00:00Z',
  created_at: '2026-09-18T09:00:00Z',
  updated_at: '2026-09-18T10:00:00Z'
};

const order = {
  id: 'order-1',
  storefront_id: 'store-1',
  customer_ref: 'customer-1',
  channel: 'storefront',
  state: 'confirmed',
  payment_state: 'authorized',
  fulfillment_state: 'unfulfilled',
  currency: 'USD',
  total_minor: 2599,
  confirmed_at: '2026-09-18T10:30:00Z',
  created_at: '2026-09-18T10:30:00Z',
  updated_at: '2026-09-18T10:30:00Z'
};

function defaultApi(operation: string) {
  if (operation === 'catalog.list') return Promise.resolve({ products: [product] });
  if (operation === 'orders.list') return Promise.resolve({ orders: [order] });
  if (operation === 'orders.get') {
    return Promise.resolve({
      order,
      lines: [],
      payments: [{ state: 'authorized', provider: 'example', provider_reference: 'auth-123' }],
      history: [],
      events: [{ id: 'event-1', event_type: 'commerce.order.completed.v1', status: 'partial' }],
      deliveries: [
        { event_id: 'event-1', target_module: 'inventory', status: 'failed', reason_code: 'INVENTORY_ADAPTER_UNAVAILABLE' }
      ]
    });
  }
  return Promise.resolve({});
}

beforeEach(() => {
  commerceApiMock.mockImplementation((operation) => defaultApi(operation));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ATLAS Commerce routing and workspace UI', () => {
  it('adds Commerce to canonical shell navigation', () => {
    render(
      <MemoryRouter initialEntries={['/commerce']}>
        <AtlasShell><div>Commerce route body</div></AtlasShell>
      </MemoryRouter>
    );
    expect(screen.getByRole('link', { name: 'Commerce' })).toHaveAttribute('href', '/commerce');
  });

  it.each([
    ['/commerce', 'ATLAS Commerce'],
    ['/commerce/products', 'Products'],
    ['/commerce/orders', 'Orders'],
    ['/commerce/orders/order-1', 'Order order-1']
  ])('resolves %s to %s', async (path, heading) => {
    render(<MemoryRouter initialEntries={[path]}><CommerceRoutes /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
  });

  it('mounts Commerce behind the existing identity guard', () => {
    expect(resolverSource).toContain("pathname === '/commerce'");
    expect(resolverSource).toContain("pathname.startsWith('/commerce/')");
    expect(resolverSource).toContain('<RequireAtlasIdentity>');
    expect(resolverSource).toContain('<CommerceRoutes />');
  });

  it('searches returned products without fabricating records', async () => {
    render(<MemoryRouter initialEntries={['/commerce/products']}><CommerceRoutes /></MemoryRouter>);
    expect(await screen.findByText('Atlas Field Kit')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'missing' } });
    expect(screen.getByText('No matching products')).toBeInTheDocument();
    expect(screen.queryByText('Atlas Field Kit')).not.toBeInTheDocument();
  });

  it('renders order, payment and integration states separately', async () => {
    render(<MemoryRouter initialEntries={['/commerce/orders/order-1']}><CommerceRoutes /></MemoryRouter>);
    expect(await screen.findByText('Order state: confirmed')).toBeInTheDocument();
    expect(screen.getByText('Payment state: authorized')).toBeInTheDocument();
    expect(screen.getByText('Fulfillment state: unfulfilled')).toBeInTheDocument();
    expect(await screen.findByText('inventory: failed')).toBeInTheDocument();
    expect(screen.getByText('INVENTORY_ADAPTER_UNAVAILABLE')).toBeInTheDocument();
    await waitFor(() => expect(commerceApiMock).toHaveBeenCalledWith('orders.get', { orderId: 'order-1' }));
  });
});
