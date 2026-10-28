"""Negative TDD and offline smoke tests for ATLAS Cinematic Engine 777."""
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from cinematic_composer import render, secure_asset, validate_spec


class CinematicSafetyTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.assets = self.root / 'assets'
        self.assets.mkdir()
        # Use ffmpeg itself to create a synthetic source; no fixture download.
        from PIL import Image
        Image.new('RGB', (360, 640), '#14283a').save(self.assets / 'scene.png')
        self.spec = {'size': [360, 640], 'scenes': [{'media': 'scene.png', 'duration': 1.3}]}

    def tearDown(self):
        self.tmp.cleanup()

    def test_accepts_valid_scene(self):
        self.assertEqual(validate_spec(self.spec, self.assets)['total'], 1.3)

    def test_rejects_path_traversal_remote_urls_and_backslashes(self):
        for name in ('../secret.png', '/etc/passwd', 'https://example.com/a.mp4', r'dir\\file.png'):
            with self.subTest(name=name), self.assertRaises(ValueError):
                validate_spec({**self.spec, 'scenes': [{'media': name, 'duration': 1.2}]}, self.assets)

    def test_rejects_symlink_even_if_target_exists(self):
        (self.assets / 'link.png').symlink_to(self.assets / 'scene.png')
        with self.assertRaises(ValueError):
            secure_asset(self.assets, 'link.png', frozenset({'.png'}))

    def test_rejects_invalid_duration(self):
        for duration in (0, -1, 31, float('nan'), True):
            with self.subTest(duration=duration), self.assertRaises(ValueError):
                validate_spec({**self.spec, 'scenes': [{'media': 'scene.png', 'duration': duration}]}, self.assets)

    def test_rejects_untrusted_size_motion_and_unbounded_scene_count(self):
        for change in ({'size': [2000, 4000]}, {'scenes': []},
                       {'scenes': [{'media': 'scene.png', 'duration': 1.0, 'motion': 'shell'}]},
                       {'scenes': [{'media': 'scene.png', 'duration': 8}] * 25}):
            with self.subTest(change=change), self.assertRaises(ValueError):
                validate_spec({**self.spec, **change}, self.assets)

    def test_no_write_into_asset_root(self):
        with self.assertRaisesRegex(ValueError, 'output_in_asset_root'):
            render(self.spec, self.assets, self.assets / 'proof.mp4')

    def test_offline_smoke_creates_video_and_audio(self):
        result = render(self.spec, self.assets, self.root / 'render' / 'proof.mp4')
        self.assertTrue(result['ok'])
        self.assertEqual(result['dimensions'], [360, 640])
        self.assertFalse(result['published'])
        self.assertFalse(result['generated_photorealistic_footage'])


if __name__ == '__main__':
    unittest.main()
