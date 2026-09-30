import { expect, it } from 'vitest';
import { browserDomainAllowed, validateBrowserCommand } from '../../tools/local-agent/lib/browser-cdp.mjs';

it('allows exact and subdomain matches only', () => {
  expect(browserDomainAllowed('app.hubspot.com',['hubspot.com'])).toBe(true);
  expect(browserDomainAllowed('evilhubspot.com',['hubspot.com'])).toBe(false);
});

it('rejects navigation outside the browser allowlist and rejects plaintext HTTP', () => {
  expect(() => validateBrowserCommand('navigate',{url:'https://example.com'},['hubspot.com']))
    .toThrow('browser_domain_not_allowed');
  expect(() => validateBrowserCommand('navigate',{url:'http://app.hubspot.com'},['hubspot.com']))
    .toThrow('browser_domain_not_allowed');
});

it('keeps password-like typing behind a human boundary', () => {
  expect(() => validateBrowserCommand('type',{domain:'app.hubspot.com',target:'input[type=password]',value:'x'},['hubspot.com']))
    .toThrow('browser_sensitive_input_requires_human');
});

it('accepts an exact semantic click target for an allowed session', () => {
  expect(() => validateBrowserCommand('click',{domain:'app.hubspot.com',target:'text:Choose Account'},['hubspot.com']))
    .not.toThrow();
});

it('supports explicit OAuth consent as a distinct action', () => {
  expect(() => validateBrowserCommand('oauth_consent',{domain:'app.hubspot.com',target:'text:Choose Account'},['hubspot.com']))
    .not.toThrow();
});

it('requires every DOM action to declare its expected allowed domain', () => {
  expect(() => validateBrowserCommand('click',{target:'text:Choose Account'},['hubspot.com']))
    .toThrow('browser_expected_domain_required');
});

it('accepts bounded read-only CDP diagnostics for an allowed domain', () => {
  expect(() => validateBrowserCommand('diagnose',{
    domain:'www.atlasenterprisesuite.com',
    observation_ms:1500,
    reload:false
  },['atlasenterprisesuite.com'])).not.toThrow();
});

it('rejects unbounded or malformed CDP diagnostic observation windows', () => {
  expect(() => validateBrowserCommand('diagnose',{
    domain:'www.atlasenterprisesuite.com',
    observation_ms:10
  },['atlasenterprisesuite.com'])).toThrow('browser_diagnose_observation_invalid');
  expect(() => validateBrowserCommand('diagnose',{
    domain:'www.atlasenterprisesuite.com',
    reload:'yes'
  },['atlasenterprisesuite.com'])).toThrow('browser_diagnose_reload_invalid');
});
