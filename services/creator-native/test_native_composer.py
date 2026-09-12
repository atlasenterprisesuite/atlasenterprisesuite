import json
import subprocess
import tempfile
import unittest
from pathlib import Path

from native_composer import validate_request, render_video


class NativeComposerTests(unittest.TestCase):
    def test_rejects_empty_script(self):
        with self.assertRaisesRegex(ValueError, 'script_required'):
            validate_request({'script': '   ', 'aspectRatio': '9:16'})

    def test_rejects_metered_or_remote_fallback(self):
        with self.assertRaisesRegex(ValueError, 'external_provider_forbidden'):
            validate_request({
                'script': 'Hola mundo',
                'aspectRatio': '9:16',
                'provider': 'heygen'
            })

    def test_renders_vertical_mp4_with_h264_and_aac(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / 'proof.mp4'
            result = render_video({
                'title': 'ATLAS native proof',
                'script': 'Hola. Humanidad primero.',
                'aspectRatio': '9:16',
                'voice': 'es-la',
                'speechRate': 210,
                'captions': [
                    {'start': 0.0, 'end': 1.2, 'text': 'HUMANIDAD PRIMERO'}
                ]
            }, output)
            self.assertEqual(result['billingClass'], 'zero-cost')
            self.assertEqual(result['execution'], 'self-hosted')
            self.assertTrue(output.exists())
            probe = subprocess.check_output([
                'ffprobe', '-v', 'error', '-show_entries',
                'stream=codec_name,width,height', '-of', 'json', str(output)
            ], text=True)
            streams = json.loads(probe)['streams']
            self.assertEqual(streams[0]['codec_name'], 'h264')
            self.assertEqual((streams[0]['width'], streams[0]['height']), (1080, 1920))
            self.assertTrue(any(stream['codec_name'] == 'aac' for stream in streams))


if __name__ == '__main__':
    unittest.main()
