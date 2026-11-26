"""Offline personal voice unit tests with synthetic audio only.

No private user audio, pretrained weights, external downloads, or provider charges.
"""
import hashlib
import io
import json
import os
import sys
import types
import tempfile
import unittest
import wave
from dataclasses import replace
from pathlib import Path
from unittest.mock import patch

from personal_voice_local import (
    ChatterboxV3Engine,
    PersonalVoiceJob,
    TrustedReference,
    personal_voice_readiness,
    MODEL_REQUIRED_FILES,
    MODEL_MANIFEST_NAME,
    verified_model_directory,
    render_personal_voice,
    verify_reference,
)

TENANT = '11111111-1111-4111-8111-111111111111'
ORG = '22222222-2222-4222-8222-222222222222'
OWNER = '33333333-3333-4333-8333-333333333333'
PROFILE = '44444444-4444-4444-8444-444444444444'


def synthetic_wav(seconds=5, framerate=16000):
    stream = io.BytesIO()
    with wave.open(stream, 'wb') as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(framerate)
        audio.writeframes(b'\0\0' * (seconds * framerate))
    return stream.getvalue()


class FakeEngine:
    def __init__(self, callback=None):
        self.calls = []
        self.callback = callback

    def synthesize(self, text, language_id, reference_path):
        self.calls.append((text, language_id, reference_path))
        if self.callback:
            self.callback()
        return synthetic_wav(seconds=1)


class PersonalVoiceLocalTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / 'reference.wav'
        self.path.write_bytes(synthetic_wav())
        self.job = PersonalVoiceJob(
            tenant_id=TENANT, organization_id=ORG, owner_id=OWNER,
            profile_id=PROFILE, consent_version='v1', purpose='narration_export',
            locale='es-MX', text='ATLAS es soberano.'
        )
        self.reference = TrustedReference(
            path=self.path, tenant_id=TENANT, organization_id=ORG,
            owner_id=OWNER, profile_id=PROFILE, consent_version='v1',
            sha256=hashlib.sha256(self.path.read_bytes()).hexdigest()
        )

    def render(self, engine=None, authorize=None, resolver=None, job=None):
        return render_personal_voice(
            job or self.job,
            authorize=authorize or (lambda _: True),
            reference_resolver=resolver or (lambda _: self.reference),
            engine=engine or FakeEngine()
        )

    def test_inference_calls_local_engine_with_verified_reference(self):
        engine = FakeEngine()
        rendered = self.render(engine=engine)
        self.assertEqual(rendered[0:4], b'RIFF')
        self.assertEqual(len(engine.calls), 1)
        self.assertEqual(engine.calls[0][:2], ('ATLAS es soberano.', 'es'))
        # Inference reads a private short-lived snapshot; it does not retain or
        # reuse the original Storage resolver's decrypted reference path.
        self.assertNotEqual(engine.calls[0][2], self.path)
        self.assertFalse(engine.calls[0][2].exists())

    def test_private_reference_copy_matches_verified_original(self):
        original_hash = hashlib.sha256(self.path.read_bytes()).hexdigest()
        hashes = []
        engine = FakeEngine(callback=lambda: hashes.append(
            hashlib.sha256(engine.calls[-1][2].read_bytes()).hexdigest()))
        self.render(engine=engine)
        self.assertEqual(hashes, [original_hash])
        self.assertFalse(engine.calls[-1][2].exists())

    def test_supports_english_request_without_claiming_language_quality(self):
        engine = FakeEngine()
        self.render(engine=engine, job=replace(self.job, locale='en-US', text='ATLAS voice test.'))
        self.assertEqual(engine.calls[0][1], 'en')

    def test_rejects_unapproved_locale_publication_and_invalid_text(self):
        for request in (
            replace(self.job, locale='fr-FR'),
            replace(self.job, purpose='public_release'),
            replace(self.job, text=' '),
            replace(self.job, text='x' * 801),
            replace(self.job, profile_id='../../malicious'),
        ):
            with self.subTest(request=request), self.assertRaises(ValueError):
                self.render(job=request)

    def test_denies_before_loading_reference_or_inference(self):
        engine = FakeEngine()
        resolver_called = []
        with self.assertRaisesRegex(PermissionError, 'personal_voice_authorization_denied'):
            self.render(engine=engine, authorize=lambda _: False,
                        resolver=lambda _: resolver_called.append(True))
        self.assertEqual(engine.calls, [])
        self.assertEqual(resolver_called, [])

    def test_revocation_during_generation_discards_audio(self):
        permission = {'allowed': True}
        engine = FakeEngine(callback=lambda: permission.update(allowed=False))
        with self.assertRaisesRegex(PermissionError, 'personal_voice_authorization_revoked'):
            self.render(engine=engine, authorize=lambda _: permission['allowed'])
        self.assertEqual(len(engine.calls), 1)

    def test_reference_scope_does_not_cross_organizations_or_owners(self):
        for crossed in (
            replace(self.reference, organization_id=TENANT),
            replace(self.reference, owner_id=ORG),
            replace(self.reference, profile_id=OWNER),
            replace(self.reference, consent_version='v2'),
        ):
            with self.subTest(crossed=crossed), self.assertRaisesRegex(PermissionError, 'scope_mismatch'):
                self.render(resolver=lambda _: crossed)

    def test_reference_sha256_is_verified(self):
        self.path.write_bytes(synthetic_wav(seconds=6))
        with self.assertRaisesRegex(ValueError, 'integrity_failed'):
            self.render()

    def test_reference_duration_and_format_are_bounded(self):
        for seconds in (1, 31):
            self.path.write_bytes(synthetic_wav(seconds=seconds))
            reference = replace(self.reference,
                                sha256=hashlib.sha256(self.path.read_bytes()).hexdigest())
            with self.subTest(seconds=seconds), self.assertRaisesRegex(ValueError, 'duration_invalid'):
                self.render(resolver=lambda _: reference)
        self.path.write_bytes(b'garbage audio')
        reference = replace(self.reference, sha256=hashlib.sha256(self.path.read_bytes()).hexdigest())
        with self.assertRaises(ValueError):
            self.render(resolver=lambda _: reference)

    def test_reference_symlinks_are_rejected(self):
        link = Path(self.tmp.name) / 'link.wav'
        try:
            link.symlink_to(self.path)
        except (OSError, NotImplementedError):
            self.skipTest('symlink unavailable')
        with self.assertRaisesRegex(ValueError, 'reference_invalid'):
            verify_reference(self.job, replace(self.reference, path=link))

    def test_invalid_engine_response_is_never_delivered(self):
        engine = FakeEngine()
        engine.synthesize = lambda *args: b'surprise'
        with self.assertRaisesRegex(RuntimeError, 'invalid_audio'):
            self.render(engine=engine)

    def test_default_runtime_never_triggers_model_download_implicitly(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertEqual(personal_voice_readiness()['state'], 'configuration_required')
            with self.assertRaisesRegex(RuntimeError, 'offline_model_not_configured'):
                ChatterboxV3Engine().synthesize('Hola', 'es', self.path)

    def test_offline_mode_requires_all_prerequisites(self):
        with patch.dict(os.environ, {'ATLAS_PERSONAL_VOICE_ENABLED': '1',
                                     'HF_HUB_OFFLINE': '1',
                                     'TRANSFORMERS_OFFLINE': '0'}, clear=True):
            self.assertFalse(personal_voice_readiness()['offline_enforced'])
            with self.assertRaisesRegex(RuntimeError, 'offline_model_not_configured'):
                ChatterboxV3Engine().synthesize('Hola', 'es', self.path)



class ModelArtifactIntegrityTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.folder = Path(self.tmp.name)
        self.digests = {}
        for name in MODEL_REQUIRED_FILES:
            body = ('test-artifact:' + name).encode()
            (self.folder / name).write_bytes(body)
            self.digests[name] = hashlib.sha256(body).hexdigest()
        self.manifest_path = self.folder / MODEL_MANIFEST_NAME
        self.update_manifest()
        self.environment = {
            'ATLAS_PERSONAL_VOICE_ENABLED': '1',
            'HF_HUB_OFFLINE': '1',
            'TRANSFORMERS_OFFLINE': '1',
            'ATLAS_PERSONAL_VOICE_MODEL_DIR': str(self.folder),
            'ATLAS_PERSONAL_VOICE_MANIFEST_SHA256': self.manifest_hash,
            'ATLAS_PERSONAL_VOICE_DEVICE': 'cpu',
        }

    def update_manifest(self):
        content = json.dumps({
            'model': 'chatterbox_multilingual_v3', 't3_model': 'v3',
            'files': self.digests,
        }, sort_keys=True).encode()
        self.manifest_path.write_bytes(content)
        self.manifest_hash = hashlib.sha256(content).hexdigest()

    def test_preinstalled_model_artifacts_are_pin_verified(self):
        with patch.dict(os.environ, self.environment, clear=True):
            self.assertEqual(verified_model_directory(), self.folder)

    def test_altered_model_weight_is_rejected_before_inference(self):
        self.folder.joinpath('t3_mtl23ls_v3.safetensors').write_bytes(b'tampered')
        with patch.dict(os.environ, self.environment, clear=True):
            with self.assertRaisesRegex(RuntimeError, 'file_integrity_failed'):
                verified_model_directory()

    def test_replaced_manifest_is_rejected_even_when_files_exist(self):
        self.update_manifest()
        self.manifest_path.write_bytes(b'{}')
        with patch.dict(os.environ, self.environment, clear=True):
            with self.assertRaisesRegex(RuntimeError, 'manifest_integrity_failed'):
                verified_model_directory()

    def test_symlinked_model_artifact_is_refused(self):
        name = 've.pt'
        target = self.folder / 'target'
        target.write_bytes((self.folder / name).read_bytes())
        (self.folder / name).unlink()
        try:
            (self.folder / name).symlink_to(target)
        except (OSError, NotImplementedError):
            self.skipTest('symlink unavailable')
        with patch.dict(os.environ, self.environment, clear=True):
            with self.assertRaisesRegex(RuntimeError, 'model_file_missing'):
                verified_model_directory()

    def test_no_snapshot_download_from_pretrained_is_called(self):
        class FakeVoiceModel:
            sr = 16000
            def generate(self, text, language_id, audio_prompt_path):
                return object()

        class FakeChatterbox:
            from_local_calls = []
            @classmethod
            def from_local(cls, directory, device, t3_model):
                cls.from_local_calls.append((directory, device, t3_model))
                return FakeVoiceModel()
            @classmethod
            def from_pretrained(cls, **kwargs):
                raise AssertionError('snapshot_download is forbidden')

        fake_torchaudio = types.ModuleType('torchaudio')
        fake_torchaudio.save = lambda path, waveform, sample_rate: Path(path).write_bytes(synthetic_wav(seconds=1))
        fake_package = types.ModuleType('chatterbox')
        fake_package.__path__ = []
        fake_multilingual = types.ModuleType('chatterbox.mtl_tts')
        fake_multilingual.ChatterboxMultilingualTTS = FakeChatterbox
        with patch.dict(os.environ, self.environment, clear=True):
            with patch.dict(sys.modules, {
                'torchaudio':fake_torchaudio,
                'chatterbox':fake_package,
                'chatterbox.mtl_tts':fake_multilingual,
            }):
                output = ChatterboxV3Engine().synthesize('Hola', 'es', self.folder / 'reference.wav')
        self.assertTrue(output.startswith(b'RIFF'))
        self.assertEqual(FakeChatterbox.from_local_calls, [(self.folder,'cpu','v3')])



if __name__ == '__main__':
    unittest.main()
