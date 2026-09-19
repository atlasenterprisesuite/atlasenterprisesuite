import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  commercePermissionsForRole,
  isPublicCommerceOperation,
  requiredCommercePermissionForOperation
} from '../../supabase/functions/atlas-commerce/operations';

const indexPath = 'supabase/functions/atlas-commerce/index.ts';
const source = existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : '';

describe('ATLAS Commerce operation governance', () => {
  it('keeps public reads separate from workspace operations', () => {
    expect(isPublicCommerceOperation('storefront.catalog')).toBe(true);
    expect(isPublicCommerceOperation('storefront.product')).toBe(true);
    expect(isPublicCommerceOperation('catalog.upsert')).toBe(false);
    expect(isPublicCommerceOperation('checkout.submit')).toBe(false);
  });

  it('maps workspace mutations to explicit Commerce permissions', () => {
    expect(requiredCommercePermissionForOperation('catalog.list')).toBe('commerce.catalog.read');
    expect(requiredCommercePermissionForOperation('catalog.upsert')).toBe('commerce.catalog.manage');
    expect(requiredCommercePermissionForOperation('orders.get')).toBe('commerce.orders.read');
    expect(requiredCommercePermissionForOperation('checkout.submit')).toBe('commerce.orders.manage');
    expect(requiredCommercePermissionForOperation('payments.status')).toBe('commerce.read');
  });

  it('does not let a generic member acquire Commerce mutation authority', () => {
    expect(commercePermissionsForRole('member')).toContain('commerce.read');
    expect(commercePermissionsForRole('member')).not.toContain('commerce.catalog.manage');
    expect(commercePermissionsForRole('admin')).toContain('commerce.admin');
  });
});

describe('ATLAS Commerce Edge source contract', () => {
  it('resolves authenticated workspace scope from user plus active membership', () => {
    expect(existsSync(indexPath)).toBe(true);
    expect(source).toContain('auth.getUser');
    expect(source).toContain("from('organization_members')");
    expect(source).toContain("eq('status', 'active')");
    expect(source).toContain('tenantId: orgId');
    expect(source).not.toContain('body.tenantId');
  });

  it('implements public published-only catalog reads without workspace permission reuse', () => {
    expect(source).toContain("'storefront.catalog'");
    expect(source).toContain("'storefront.product'");
    expect(source).toContain("eq('status', 'published')");
    expect(source).toContain("eq('state', 'published')");
  });

  it('recomputes checkout and fails closed through the payment boundary', () => {
    expect(source).toContain('priceCart');
    expect(source).toContain('UnavailablePaymentAdapter');
    expect(source).toContain('AuthorizeNetPaymentAdapter');
    expect(source).toContain('evaluatePaymentResult');
    expect(source).toContain('PAYMENT_PROVIDER_UNAVAILABLE');
    expect(source).toContain("rpc('commerce_commit_order'");
  });

  it('reads Authorize.net credentials only through the server secret store and exposes readiness without secret values', () => {
    expect(source).toContain('getServerSecret');
    expect(source).toContain('authorizeNetSecretName(context.orgId');
    expect(source).toContain("'api_login_id'");
    expect(source).toContain("'transaction_key'");
    expect(source).toContain("'payments.status'");
    expect(source).toContain('storesRawBankData: false');
    expect(source).not.toContain('body.apiLoginId');
    expect(source).not.toContain('body.transactionKey');
    expect(source).not.toContain("name: 'authorize_net_api_login_id'");
    expect(source).not.toContain("name: 'authorize_net_transaction_key'");
  });
});
