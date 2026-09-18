import React from 'react';
import { readFileSync } from 'node:fs';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../apps/web/src/modules/commerce/commerceApi', () => ({
  publicCommerceApi: vi.fn()
}));

import { PublicCommerceRoutes } from '../../apps/web/src/modules/commerce/storefront/PublicCommerceRoutes';
import { publicCommerceApi } from '../../apps/web/src/modules/commerce/commerceApi';

const apiMock = vi.mocked(publicCommerceApi);
const appSource = readFileSync('apps/web/src/App.tsx', 'utf8');

const storefront = { id: 'store-1', slug: 'atlas', name: 'ATLAS Store', currency: 'USD', status: 'published' };
const product = {
  id: 'product-1',
  storefront_id: 'store-1',
  title: 'Atlas Field Kit',
  slug: 'atlas-field-kit',
  description: 'Field operations kit',
  state: 'published',
  variants: [{ id: 'v1', product_id: 'product-1', sku: 'AFK-1', title: 'Standard', currency: 'USD', price_minor: 2599, state: 'published' }],
  media: [{ id: 'm1', product_id: 'product-1', variant_id: null, asset_source: 'library_image', asset_id: 'asset-1', media_type: 'image', alt_text: 'Field kit', sort_order: 0 }]
};

beforeEach(() => {
  apiMock.mockImplementation((operation) => {
    if (operation === 'storefront.catalog') return Promise.resolve({ storefront, products: [product] });
    if (operation === 'storefront.product') return Promise.resolve({ storefront, product });
    return Promise.resolve({});
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  sessionStorage.clear();
});

describe('public ATLAS Commerce storefront', () => {
  it('mounts /shop outside RequireAtlasIdentity and outside AtlasShell', () => {
    expect(appSource).toContain("location.pathname.startsWith('/shop/')");
    expect(appSource).toContain('<PublicCommerceRoutes />');
    const shopBranch = appSource.slice(
      appSource.indexOf("location.pathname.startsWith('/shop/')"),
      appSource.indexOf("location.pathname.startsWith('/insurance')")
    );
    expect(shopBranch).not.toContain('RequireAtlasIdentity');
    expect(shopBranch).not.toContain('AtlasShell');
  });

  it.each([
    ['/shop/atlas', 'ATLAS Store'],
    ['/shop/atlas/products/atlas-field-kit', 'Atlas Field Kit'],
    ['/shop/atlas/cart', 'Cart']
  ])('renders %s publicly', async (path, heading) => {
    render(<MemoryRouter initialEntries={[path]}><PublicCommerceRoutes /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
  });

  it('renders only published API-returned product data and returned asset references', async () => {
    render(<MemoryRouter initialEntries={['/shop/atlas']}><PublicCommerceRoutes /></MemoryRouter>);
    expect(await screen.findByText('Atlas Field Kit')).toBeInTheDocument();
    expect(screen.getByText('library_image:asset-1')).toBeInTheDocument();
  });

  it('keeps checkout explicitly blocked instead of fabricating payment success', async () => {
    render(<MemoryRouter initialEntries={['/shop/atlas/cart']}><PublicCommerceRoutes /></MemoryRouter>);
    expect(await screen.findByText('Checkout unavailable')).toBeInTheDocument();
    expect(screen.getByText(/payment provider/i)).toBeInTheDocument();
    expect(screen.queryByText(/payment successful/i)).not.toBeInTheDocument();
  });
});
