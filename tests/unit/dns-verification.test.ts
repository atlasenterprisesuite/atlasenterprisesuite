import { expect, it } from 'vitest';
import { normalizeDnsTxtAnswer, verifyDnsTxt } from '../../packages/execution/src/dns-verification';

it('joins quoted DNS TXT chunks without changing the value', () => {
  expect(normalizeDnsTxtAnswer('"openai-domain-" "verification=abc"')).toBe('openai-domain-verification=abc');
});

it('requires exact value equality', () => {
  expect(verifyDnsTxt('openai-domain-verification=abc', ['"openai-domain-verification=abc"']).verified).toBe(true);
  expect(verifyDnsTxt('openai-domain-verification=abc', ['"openai-domain-verification=abcd"']).verified).toBe(false);
});

it('does not lowercase or trim internal TXT content', () => {
  expect(verifyDnsTxt('Case=ABC', ['"case=ABC"']).verified).toBe(false);
});
