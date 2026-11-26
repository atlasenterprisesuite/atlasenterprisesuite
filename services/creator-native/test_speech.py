"""Tests for first-party generic speech, never personal voice cloning."""
import json
import os
import shutil
import threading
import unittest
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from unittest.mock import patch

from app import NativeComposerHandler
from speech import GENERIC_VOICES, synthesize_generic_speech, validate_speech_request


class GenericSpeechTests(unittest.TestCase):
    def test_validates_local_generic_speech(self):
        request = validate_speech_request({
            'mode': 'generic', 'text': ' Hola desde ATLAS. ',
            'locale': 'es-MX', 'speechRate': 185
        })
        self.assertEqual(request['text'], 'Hola desde ATLAS.')
        self.assertEqual(request['voice'], GENERIC_VOICES['es-MX'])

    def test_never_mislabels_personal_voice_or_imports_samples(self):
        for payload in [
            {'mode': 'personal', 'text': 'Hola', 'locale': 'es-ES'},
            {'mode': 'generic', 'text': 'Hola', 'locale': 'es-ES', 'privateVoiceRef': 'secret'},
            {'mode': 'generic', 'text': 'Hola', 'locale': 'es-ES', 'profile_id': 'owner'}
        ]:
            with self.subTest(payload=payload), self.assertRaises(ValueError):
                validate_speech_request(payload)

    def test_rejects_unverified_language_and_invalid_rate(self):
        for patch_values in [{'locale': 'fr-FR'}, {'speechRate': 999}, {'speechRate': True},
                             {'text': ' '}, {'text': 'a' * 1001}]:
            payload = {'mode': 'generic', 'text': 'Hola', 'locale': 'es-ES'}
            payload.update(patch_values)
            with self.subTest(patch_values=patch_values), self.assertRaises(ValueError):
                validate_speech_request(payload)

    @unittest.skipUnless(shutil.which('espeak'), 'eSpeak is not installed')
    def test_generates_wav_offline(self):
        audio = synthesize_generic_speech({
            'mode': 'generic', 'text': 'Hola. Esto es ATLAS.',
            'locale': 'es-ES'
        })
        self.assertTrue(audio.startswith(b'RIFF'))
        self.assertEqual(audio[8:12], b'WAVE')
        self.assertGreater(len(audio), 1000)

    @unittest.skipUnless(shutil.which('espeak'), 'eSpeak is not installed')
    def test_http_requires_authentication_and_labels_output_generic(self):
        with patch.dict(os.environ, {'ATLAS_NATIVE_COMPOSER_TOKEN': 'unit-test-only'}):
            server = ThreadingHTTPServer(('127.0.0.1', 0), NativeComposerHandler)
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                payload = json.dumps({
                    'mode': 'generic', 'text': 'Prueba de audio local.',
                    'locale': 'es-ES'
                })
                connection = HTTPConnection('127.0.0.1', server.server_port, timeout=10)
                connection.request('POST', '/speech', payload, {'content-type': 'application/json'})
                denied = connection.getresponse()
                self.assertEqual(denied.status, 401)
                denied.read()
                connection.close()

                connection = HTTPConnection('127.0.0.1', server.server_port, timeout=10)
                connection.request('POST', '/speech', payload, {
                    'content-type': 'application/json',
                    'authorization': 'Bearer unit-test-only'
                })
                response = connection.getresponse()
                audio = response.read()
                self.assertEqual(response.status, 200)
                self.assertEqual(response.getheader('x-atlas-voice-mode'), 'generic')
                self.assertEqual(response.getheader('content-type'), 'audio/wav')
                self.assertTrue(audio.startswith(b'RIFF'))
                connection.close()
            finally:
                server.shutdown()
                server.server_close()
                thread.join(timeout=3)


if __name__ == '__main__':
    unittest.main()
