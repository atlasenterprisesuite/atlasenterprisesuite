import { describe, expect, it } from 'vitest';
import { validateMicrosite, renderMicrositeText } from '../../packages/core/src/owned-microsite';
const scope = { organizationId: 'org-a', tenantId: 'tenant-a' };
describe('ATLAS owned microsite safe domain', () => {
 it('renders only escaped content from its own tenant', () => {
  const page = validateMicrosite({ ...scope, slug: 'profile', title: '<script>alert(1)</script>', links: [{ label: '<b>Shop</b>', href: 'https://example.com' }] });
  const html = renderMicrositeText(page, scope);
  expect(html).not.toContain('<script>');
  expect(html).not.toContain('<b>');
  expect(html).toContain('&lt;script&gt;');
 });
 it('rejects cross tenant reads', () => {
  const page = validateMicrosite({ ...scope, slug: 'profile', title: 'ATLAS', links: [] });
  expect(() => renderMicrositeText(page, { ...scope, tenantId: 'tenant-b' })).toThrow('microsite_scope_denied');
 });
 it('rejects unsafe outgoing links', () => {
  expect(() => validateMicrosite({ ...scope, slug: 'profile', title: 'ATLAS', links: [{ label: 'Unsafe', href: 'http://localhost' }] })).toThrow('link_destination_denied');
 });
});
