"""ATLAS Personal Voice: offline multilingual Chatterbox V3 inference boundary.

NOT an HTTP endpoint. An ATLAS trusted server must construct the job,
fetch/verify authorization and decrypt reference audio to an ephemeral
private WAV file. Do not pass user/agent-supplied file paths here.
"""
from __future__ import annotations

import hashlib
import hmac
import importlib.util
import os
import re
import tempfile
import wave
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Protocol

# Locale support is a request mapping, not a claim of independently verified quality.
LOCALE_LANGUAGES = {'es-ES': 'es', 'es-MX': 'es', 'en-US': 'en', 'en-GB': 'en'}
MAX_SCRIPT_CHARS = 800
MAX_REFERENCE_BYTES = 10 * 1024 * 1024
MAX_OUTPUT_BYTES = 20 * 1024 * 1024
_SHA256 = re.compile(r'^[0-9a-f]{64}$', re.ASCII)
_UUID = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$', re.IGNORECASE)


@dataclass(frozen=True)
class PersonalVoiceJob:
    tenant_id: str
    organization_id: str
    owner_id: str
    profile_id: str
    consent_version: str
    purpose: str
    locale: str
    text: str


@dataclass(frozen=True)
class TrustedReference:
    # Created by the confidential ATLAS Voice storage resolver, not an agent.
    path: Path
    tenant_id: str
    organization_id: str
    owner_id: str
    profile_id: str
    consent_version: str
    sha256: str


class PersonalVoiceEngine(Protocol):
    def synthesize(self, text: str, language_id: str, reference_path: Path) -> bytes: ...


def validate_job(job: PersonalVoiceJob) -> str:
    for value in (job.tenant_id, job.organization_id, job.owner_id, job.profile_id):
        if not _UUID.fullmatch(value):
            raise ValueError('invalid_personal_voice_identity')
    if not job.consent_version.strip() or len(job.consent_version) > 100:
        raise ValueError('invalid_consent_version')
    # The external/public and telephony purposes require a separate, stronger integration.
    if job.purpose not in {'assistant_private', 'studio_preview', 'narration_export'}:
        raise ValueError('personal_voice_purpose_unsupported')
    if job.locale not in LOCALE_LANGUAGES:
        raise ValueError('personal_voice_locale_unverified')
    if not isinstance(job.text, str) or not job.text.strip() or len(job.text) > MAX_SCRIPT_CHARS or '\x00' in job.text:
        raise ValueError('personal_voice_text_invalid')
    return LOCALE_LANGUAGES[job.locale]


def verify_reference(job: PersonalVoiceJob, reference: TrustedReference) -> None:
    if (reference.tenant_id != job.tenant_id
        or reference.organization_id != job.organization_id
        or reference.owner_id != job.owner_id
        or reference.profile_id != job.profile_id
        or reference.consent_version != job.consent_version):
        raise PermissionError('personal_voice_reference_scope_mismatch')
    if not _SHA256.fullmatch(reference.sha256):
        raise ValueError('personal_voice_reference_invalid')
    path = Path(reference.path)
    if path.is_symlink() or not path.is_file():
        raise ValueError('personal_voice_reference_invalid')
    # The file must be materialized in private storage by the trusted resolver.
    if path.suffix.lower() != '.wav':
        raise ValueError('personal_voice_reference_format_unsupported')
    if not 44 < path.stat().st_size <= MAX_REFERENCE_BYTES:
        raise ValueError('personal_voice_reference_invalid')
    digest = hashlib.sha256()
    with path.open('rb') as source:
        for data in iter(lambda: source.read(1024 * 1024), b''):
            digest.update(data)
    if not hmac.compare_digest(digest.hexdigest(), reference.sha256):
        raise ValueError('personal_voice_reference_integrity_failed')
    try:
        with wave.open(str(path), 'rb') as audio:
            if (audio.getnchannels() != 1 or audio.getsampwidth() != 2
                or audio.getframerate() not in {16000, 24000, 44100, 48000}
                or audio.getcomptype() != 'NONE'):
                raise ValueError('personal_voice_reference_format_unsupported')
            seconds = audio.getnframes() / audio.getframerate()
            if not 5.0 <= seconds <= 30.0:
                raise ValueError('personal_voice_reference_duration_invalid')
    except (wave.Error, EOFError) as exc:
        raise ValueError('personal_voice_reference_format_unsupported') from exc


def personal_voice_readiness() -> dict[str, object]:
    """No model probing that downloads weights or contacts external services."""
    enabled = os.environ.get('ATLAS_PERSONAL_VOICE_ENABLED') == '1'
    offline = os.environ.get('HF_HUB_OFFLINE') == '1' and os.environ.get('TRANSFORMERS_OFFLINE') == '1'
    try:
        model_installed = importlib.util.find_spec('chatterbox.mtl_tts') is not None
    except ModuleNotFoundError:
        model_installed = False
    configured = enabled and offline and model_installed
    return {
        'mode': 'personal_voice_offline',
        'state': 'configuration_ready' if configured else 'configuration_required',
        'model': 'chatterbox_multilingual_v3',
        'verified_synthesis': False,
        'supported_request_locales': list(LOCALE_LANGUAGES),
        'enabled': enabled,
        'offline_enforced': offline,
        'library_installed': model_installed,
    }


class ChatterboxV3Engine:
    """Optional external open-source model runs entirely inside the ATLAS host.

    A pinned, approved model artifact must already be present in the local cache.
    Both HF_HUB_OFFLINE and TRANSFORMERS_OFFLINE are mandatory fail-closed controls.
    """
    def synthesize(self, text: str, language_id: str, reference_path: Path) -> bytes:
        if (os.environ.get('ATLAS_PERSONAL_VOICE_ENABLED') != '1'
            or os.environ.get('HF_HUB_OFFLINE') != '1'
            or os.environ.get('TRANSFORMERS_OFFLINE') != '1'):
            raise RuntimeError('personal_voice_offline_model_not_configured')
        device = os.environ.get('ATLAS_PERSONAL_VOICE_DEVICE', 'cpu')
        if device not in {'cpu', 'cuda', 'mps'}:
            raise RuntimeError('personal_voice_device_invalid')
        try:
            import torchaudio
            from chatterbox.mtl_tts import ChatterboxMultilingualTTS
        except ImportError as exc:
            raise RuntimeError('personal_voice_model_not_installed') from exc
        model = ChatterboxMultilingualTTS.from_pretrained(device=device, t3_model='v3')
        waveform = model.generate(text, language_id=language_id,
                                  audio_prompt_path=str(reference_path))
        with tempfile.TemporaryDirectory(prefix='atlas-voice-out-') as tmp:
            destination = Path(tmp) / 'synthesized.wav'
            torchaudio.save(str(destination), waveform, model.sr)
            return destination.read_bytes()


def render_personal_voice(
    job: PersonalVoiceJob,
    *,
    authorize: Callable[[PersonalVoiceJob], bool],
    reference_resolver: Callable[[PersonalVoiceJob], TrustedReference],
    engine: PersonalVoiceEngine,
) -> bytes:
    """No output unless authorization passes before AND after model inference.

    Callbacks MUST read current policy/owner/tenant/consent from trusted persistence.
    This is an offline private-job primitive, never callable directly by an agent.
    """
    language_id = validate_job(job)
    if not authorize(job):
        raise PermissionError('personal_voice_authorization_denied')
    reference = reference_resolver(job)
    verify_reference(job, reference)
    # The private resolver's source may be rotated or cleaned up concurrently.
    # Copy a bounded, checksum-verified snapshot into an isolated ephemeral dir.
    # Never pass the long-lived storage reference directly to model inference.
    with tempfile.TemporaryDirectory(prefix='atlas-private-voice-') as directory:
        snapshot = Path(directory) / 'reference.wav'
        with Path(reference.path).open('rb') as source:
            audio_bytes = source.read(MAX_REFERENCE_BYTES + 1)
        if len(audio_bytes) > MAX_REFERENCE_BYTES or not hmac.compare_digest(
                hashlib.sha256(audio_bytes).hexdigest(), reference.sha256):
            raise ValueError('personal_voice_reference_integrity_failed')
        snapshot.write_bytes(audio_bytes)
        snapshot.chmod(0o600)
        wav = engine.synthesize(job.text.strip(), language_id, snapshot)
    if (not isinstance(wav, bytes) or not 44 < len(wav) <= MAX_OUTPUT_BYTES
        or wav[:4] != b'RIFF' or wav[8:12] != b'WAVE'):
        raise RuntimeError('personal_voice_invalid_audio')
    if not authorize(job):
        raise PermissionError('personal_voice_authorization_revoked')
    return wav
