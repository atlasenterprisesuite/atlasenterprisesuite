import unittest
from redirect_policy import inspect_observed_chain


class RedirectPolicyTests(unittest.TestCase):
    def test_public_chain_is_still_unverified(self):
        chain = [('https://a.example.org/x', ['8.8.8.8']), ('https://b.example.org/y', ['2606:4700::1111'])]
        self.assertEqual(inspect_observed_chain(chain), {'decision': 'NO_GO', 'reason': 'OBSERVATIONS_ONLY', 'hops': 2})

    def test_nonpublic_and_transition_addresses(self):
        for ip in ('127.0.0.1', '10.0.0.1', '100.64.0.1', '169.254.1.1', '192.0.2.1', '224.0.0.1', '240.0.0.1', '::1', 'fc00::1', 'fe80::1', 'ff02::1', '::ffff:8.8.8.8', '64:ff9b::808:808', '2002:0808:0808::1', '2001:0::1', 'fe80::1%eth0', 'bad'):
            with self.subTest(ip=ip):
                self.assertEqual(inspect_observed_chain([('https://a.example.org', ['8.8.8.8', ip])])['reason'], 'ADDRESS_REJECTED')

    def test_bad_hop_and_cycle(self):
        for chain in ([('https://a.example.org', ['8.8.8.8']), ('http://b.example.org', ['8.8.8.8'])], [('https://a.example.org', ['8.8.8.8'])]*2):
            self.assertEqual(inspect_observed_chain(chain)['reason'], 'HOP_REJECTED')

    def test_bounds_and_missing_answers(self):
        for chain in (None, [], [('https://a.example.org', ['8.8.8.8'])]*7, ['wrong']):
            self.assertNotEqual(inspect_observed_chain(chain)['reason'], 'OBSERVATIONS_ONLY')
        for answers in ([], None, '8.8.8.8', ['8.8.8.8']*17):
            self.assertEqual(inspect_observed_chain([('https://a.example.org', answers)])['reason'], 'ADDRESS_REJECTED')

    def test_no_sensitive_output(self):
        result = inspect_observed_chain([('https://private.example.org/path?q=synthetic', ['8.8.8.8'])])
        for value in ('private', 'path', 'synthetic', '8.8.8.8'):
            self.assertNotIn(value, str(result))
