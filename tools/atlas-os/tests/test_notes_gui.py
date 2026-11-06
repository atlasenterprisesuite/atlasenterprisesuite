"""Real Tk widget smoke test. Requires DISPLAY (run under xvfb-run in CI)."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

BASE = Path(__file__).resolve().parents[1]


@unittest.skipUnless(os.environ.get('DISPLAY'), 'No display; native GUI not verified locally')
class NativeNotesTests(unittest.TestCase):
    def test_unlock_edit_save_lock_and_reopen_with_real_vault(self):
        spec = importlib.util.spec_from_file_location('atlas_notes', BASE / 'notes.py')
        notes = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(notes)
        with tempfile.TemporaryDirectory() as directory:
            os.chmod(directory, 0o700)
            def local_request(action, passphrase, value=None):
                payload = {'action': action, 'passphrase': passphrase, 'value': value}
                result = subprocess.run(['node', str(BASE / 'notes-bridge.mjs'), directory],
                                        input=json.dumps(payload), text=True, capture_output=True, check=True)
                return json.loads(result.stdout)
            root = notes.tk.Tk()
            root.withdraw()
            try:
                app = notes.Notes(root)
                with patch.object(notes, 'request', side_effect=local_request), \
                     patch.object(notes.simpledialog, 'askstring', return_value='GUI fixture passphrase only'):
                    app.unlock.invoke()
                    app.text.insert('1.0', 'Native offline text')
                    root.update()
                    app.save_button.invoke()
                    self.assertFalse(app.dirty)
                    self.assertIn('Guardado cifrado local', app.status.get())
                    app.lock_button.invoke()
                    self.assertIsNone(app.passphrase)
                    self.assertEqual(app.text.get('1.0', 'end-1c'), '')
                    app.unlock.invoke()
                    self.assertEqual(app.text.get('1.0', 'end-1c'), 'Native offline text')
                    app.text.insert('end', ' unsaved')
                    root.update()
                    with patch.object(notes.messagebox, 'askyesno', return_value=False):
                        self.assertFalse(app.lock())
                        self.assertIsNotNone(app.passphrase)
            finally:
                root.destroy()


if __name__ == '__main__':
    unittest.main()
