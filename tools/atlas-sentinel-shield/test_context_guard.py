import unittest
from context_guard import evaluate_context, audit_decision

class ContextGuardTests(unittest.TestCase):
    def check(self, **changes):
        fields = dict(actor_tenant='org-a', record_tenant='org-a', source='document', verified=True)
        fields.update(changes)
        return evaluate_context(**fields)

    def test_verified_document_is_data_only(self):
        self.assertEqual(self.check(), 'DATA_ONLY')

    def test_cross_tenant_denied(self):
        self.assertEqual(self.check(record_tenant='org-b'), 'DENY_TENANT')

    def test_missing_identity_denied(self):
        for value in (None, '', ' '):
            self.assertEqual(self.check(actor_tenant=value), 'DENY_TENANT')

    def test_unverified_denied(self):
        for value in (False, None, 1, 'true'):
            self.assertEqual(self.check(verified=value), 'DENY_PROVENANCE')

    def test_unknown_source_denied(self):
        for value in ('unknown', 'instruction', None, []):
            self.assertEqual(self.check(source=value), 'DENY_SOURCE')

    def test_allowed_sources_never_grant_authority(self):
        for source in ('document', 'retrieval', 'tool_result'):
            self.assertEqual(self.check(source=source), 'DATA_ONLY')

    def test_audit_only_contains_fixed_codes(self):
        self.assertEqual(audit_decision('DATA_ONLY'), {'control': 'context_guard', 'decision': 'DATA_ONLY'})
        self.assertEqual(audit_decision('arbitrary content'), {'control': 'context_guard', 'decision': 'DENY_UNKNOWN'})
        self.assertEqual(audit_decision([])['decision'], 'DENY_UNKNOWN')

if __name__ == '__main__':
    unittest.main()
