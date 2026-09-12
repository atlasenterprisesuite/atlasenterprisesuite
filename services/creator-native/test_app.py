import unittest
from pathlib import Path

from app import bearer_authorized, safe_asset_path


class NativeComposerHttpTests(unittest.TestCase):
    def test_generation_requires_exact_bearer_token(self):
        self.assertFalse(bearer_authorized('', 'secret'))
        self.assertFalse(bearer_authorized('Bearer wrong', 'secret'))
        self.assertTrue(bearer_authorized('Bearer secret', 'secret'))

    def test_asset_path_cannot_escape_asset_root(self):
        root = Path('/tmp/atlas-assets')
        with self.assertRaisesRegex(ValueError, 'invalid_asset_path'):
            safe_asset_path(root, '../secrets.txt')
        self.assertEqual(safe_asset_path(root, 'job.mp4'), root / 'job.mp4')


if __name__ == '__main__':
    unittest.main()
