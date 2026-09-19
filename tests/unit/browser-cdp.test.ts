import { expect, it } from 'vitest';
import { browserDomainAllowed, validateBrowserCommand } from '../../tools/local-agent/lib/browser-cdp.mjs';

it('allows exact and subdomain matches only', () => {
  expect(browserDomainAllowed('app.hubspot.com',['hubspot.com'])).toBe(true);
  expect(browserDomainAllowed('evilhubspot.com',['hubspot.com'])).toBe(false);
});

it('rejects navigation outside the browser allowlist', () => {
  expect(() => validateBrowserCommand('navigate',{url:'https://example.com'},['hubspot.com']))
    .toThrow('browser_domain_not_allowed');
});

it('keeps password-like typing behind a human boundary', () => {
  expect(() => validateBrowserCommand('type',{target:'input[type=password]',value:'x'},['hubspot.com']))
    .toThrow('browser_sensitive_input_requires_human');
});

it('accepts a bounded click command for an allowed session', () => {
  expect(() => validateBrowserCommand('click',{target:'text=Choose Account'},['hubspot.com']))
    .not.toThrow();
});
