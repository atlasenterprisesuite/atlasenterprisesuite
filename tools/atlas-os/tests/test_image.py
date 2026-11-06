import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

MODULE = Path(__file__).resolve().parents[1] / 'image.py'


class ImageTests(unittest.TestCase):
    def test_prepare_contains_real_runtime_and_integrity_manifest(self):
        with tempfile.TemporaryDirectory() as temp:
            target = Path(temp) / 'live'
            result = subprocess.run(['python3', str(MODULE), 'prepare', str(target)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            runtime = target / 'config/includes.chroot/usr/share/atlas-os'
            manifest = json.loads((runtime / 'SOURCE.json').read_text())
            self.assertEqual(manifest['certified'], False)
            for relative, digest in manifest['files'].items():
                self.assertEqual(hashlib.sha256((runtime / relative).read_bytes()).hexdigest(), digest)
            self.assertIn('python3-tk', (target / 'config/package-lists/atlas.list.chroot').read_text())
            config = (target / 'auto/config').read_text()
            self.assertIn('--debian-installer false', config)
            self.assertNotIn('persistence', config)
            subprocess.run(['sh', '-n', str(target / 'auto/config')], check=True)
            launcher = target / 'config/includes.chroot/usr/bin/atlas-notes'
            subprocess.run(['sh', '-n', str(launcher)], check=True)
            second = subprocess.run(['python3', str(MODULE), 'prepare', str(target)], capture_output=True)
            self.assertNotEqual(second.returncode, 0)

    def test_preflight_reports_missing_build_dependencies_without_building(self):
        spec = importlib.util.spec_from_file_location('atlas_image', MODULE)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        from unittest.mock import patch
        with patch.object(module.shutil, 'which', return_value=None):
            missing = module.missing_dependencies()
        self.assertIn('lb', missing)
        self.assertIn('debootstrap', missing)


if __name__ == '__main__':
    unittest.main()
