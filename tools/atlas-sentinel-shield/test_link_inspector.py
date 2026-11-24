import unittest
from link_inspector import inspect_link


class LinkInspectorTests(unittest.TestCase):
    def test_public_url_is_unverified(self):
        self.assertEqual(inspect_link('https://video.example.org/watch?private=abc'),
                         {'decision': 'NO_GO', 'reason': 'UNVERIFIED', 'host': 'video.example.org'})

    def test_rejects_ambiguous_or_local_targets(self):
        for url in ('http://example.org', 'https://user@example.org',
                    'https://example.org@evil.org', 'https://127.0.0.1',
                    'https://[::1]', 'https://2130706433', 'https://0x7f.0.0.1',
                    'https://localhost', 'https://a.local', 'https://a.internal',
                    'https://example.org:8443', 'https://example.org\\evil.org',
                    'https://example.org\n', 'https://%65xample.org',
                    'https://xn--example.org', 'https://éxample.org',
                    'https://example.org:443', 'https://example.org.'):
            with self.subTest(url=url):
                self.assertEqual(inspect_link(url)['reason'], 'REJECTED')

    def test_redacts_path_query_fragment_and_rejected_input(self):
        for url in ('https://example.org/private?token=synthetic#secret',
                    'https://synthetic@example.org'):
            result = str(inspect_link(url))
            for value in ('private', 'synthetic', 'secret'):
                self.assertNotIn(value, result)

    def test_invalid_types_and_bounds(self):
        for value in (None, 4, '', 'https://example.org/' + 'x' * 4096):
            self.assertEqual(inspect_link(value)['reason'], 'REJECTED')


if __name__ == '__main__':
    unittest.main()
