import { expect, it } from 'vitest';
import { applyVerifiedEndpointMigration, resolveProviderEndpoint } from '../../packages/core/src';

it('normalizes a secure provider URL', () => {
  expect(resolveProviderEndpoint('https://example.my.salesforce.com/')).toEqual({
    origin: 'https://example.my.salesforce.com',
    verified: false
  });
});

it('rejects insecure remote URLs', () => {
  expect(() => resolveProviderEndpoint('http://example.com')).toThrow(
    'insecure_provider_endpoint'
  );
});

it('rejects endpoint URLs with embedded credentials', () => {
  expect(() => resolveProviderEndpoint('https://user:secret@example.com')).toThrow(
    'credentialed_provider_endpoint'
  );
});

it('updates only after migration verification', () => {
  const current = { origin: 'https://old.example.com', verified: true };

  expect(
    applyVerifiedEndpointMigration(current, 'https://new.example.com', false)
  ).toEqual(current);

  expect(
    applyVerifiedEndpointMigration(current, 'https://new.example.com', true)
  ).toEqual({
    origin: 'https://new.example.com',
    verified: true
  });
});
