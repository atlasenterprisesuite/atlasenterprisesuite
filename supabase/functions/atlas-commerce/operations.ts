export type CommerceApiOperation =
  | 'catalog.list'
  | 'catalog.upsert'
  | 'orders.list'
  | 'orders.get'
  | 'checkout.prepare'
  | 'checkout.submit'
  | 'payments.status'
  | 'storefront.catalog'
  | 'storefront.product';

export type WorkspaceCommerceOperation = Exclude<
  CommerceApiOperation,
  'storefront.catalog' | 'storefront.product'
>;

export type CommercePermission =
  | 'commerce.read'
  | 'commerce.catalog.read'
  | 'commerce.catalog.manage'
  | 'commerce.orders.read'
  | 'commerce.orders.manage'
  | 'commerce.admin';

const PUBLIC_OPERATIONS = new Set<CommerceApiOperation>([
  'storefront.catalog',
  'storefront.product'
]);

const REQUIRED_PERMISSIONS: Record<WorkspaceCommerceOperation, CommercePermission> = {
  'catalog.list': 'commerce.catalog.read',
  'catalog.upsert': 'commerce.catalog.manage',
  'orders.list': 'commerce.orders.read',
  'orders.get': 'commerce.orders.read',
  'checkout.prepare': 'commerce.orders.manage',
  'checkout.submit': 'commerce.orders.manage',
  'payments.status': 'commerce.read'
};

export function isPublicCommerceOperation(
  operation: string
): operation is 'storefront.catalog' | 'storefront.product' {
  return PUBLIC_OPERATIONS.has(operation as CommerceApiOperation);
}

export function requiredCommercePermissionForOperation(
  operation: WorkspaceCommerceOperation
): CommercePermission {
  return REQUIRED_PERMISSIONS[operation];
}

export function commercePermissionsForRole(role: string): CommercePermission[] {
  switch (role.trim().toLowerCase()) {
    case 'owner':
    case 'admin':
    case 'platform_admin':
      return ['commerce.admin'];
    case 'manager':
      return [
        'commerce.read',
        'commerce.catalog.read',
        'commerce.catalog.manage',
        'commerce.orders.read',
        'commerce.orders.manage'
      ];
    default:
      return ['commerce.read', 'commerce.catalog.read', 'commerce.orders.read'];
  }
}
