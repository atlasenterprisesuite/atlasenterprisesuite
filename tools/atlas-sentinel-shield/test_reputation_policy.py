import unittest
from reputation_policy import assess_reputation

class ReputationTests(unittest.TestCase):
    def test_unknown(self):
        self.assertEqual(assess_reputation('https://example.org/a', [])['reason'], 'UNKNOWN')

    def test_adverse(self):
        for status in ('malicious', 'suspicious'):
            self.assertEqual(assess_reputation('https://example.org/a', [('example.org', status)])['reason'], 'ADVERSE_REPORT')

    def test_positive_never_grants_access(self):
        self.assertEqual(assess_reputation('https://example.org/a', [('example.org', 'safe')])['decision'], 'NO_GO')

    def test_exact_match(self):
        self.assertEqual(assess_reputation('https://example.org.evil.org/a', [('example.org', 'malicious')])['reason'], 'UNKNOWN')

    def test_invalid(self):
        for records in (None, [('example.org', 'bad')], ['bad'], [('example.org', 'safe')]*257):
            self.assertEqual(assess_reputation('https://example.org/a', records)['reason'], 'INVALID_INPUT')

    def test_redaction_and_conflict(self):
        result = assess_reputation('https://example.org/private?q=secret', [('example.org', 'safe'), ('example.org', 'malicious')])
        self.assertEqual(result, {'decision': 'NO_GO', 'reason': 'ADVERSE_REPORT'})
