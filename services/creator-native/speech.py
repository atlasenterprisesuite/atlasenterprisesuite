"""ATLAS Native Composer: bounded, generic, self-hosted TTS.

This is NOT a personal voice clone. A future verified local model will require
the separate ATLAS Voice ownership, consent and agent authorization gateway.
"""
from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

MAX_TEXT_CHARACTERS = 1000
MAX_AUDIO_BYTES = 20_000_000
GENERIC_VOICES = {
    'es-ES': 'es',
    'es-MX': 'es-la',
    'en-US': 'en-us',
    'en-GB': 'en-gb',
}


def validate_speech_request(payload: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError('invalid_json')
    # Do not accidentally accept a personal-voice profile or training sample.
    if set(payload) - {'mode', 'text', 'locale', 'speechRate'}:
        raise ValueError('unsupported_speech_field')
    if payload.get('mode') != 'generic':
        raise ValueError('personal_voice_not_supported')
    text = payload.get('text')
    if not isinstance(text, str) or not text.strip() or len(text) > MAX_TEXT_CHARACTERS:
        raise ValueError('speech_text_invalid')
    text = text.strip()
    if '\x00' in text:
        raise ValueError('speech_text_invalid')
    locale = payload.get('locale')
    if not isinstance(locale, str) or locale not in GENERIC_VOICES:
        raise ValueError('speech_locale_unavailable')
    rate = payload.get('speechRate', 175)
    if isinstance(rate, bool) or not isinstance(rate, int) or not 100 <= rate <= 250:
        raise ValueError('speech_rate_invalid')
    return {'text': text, 'locale': locale, 'speechRate': rate, 'voice': GENERIC_VOICES[locale]}


def synthesize_generic_speech(payload: dict[str, Any]) -> bytes:
    """Return WAV bytes; never read voice samples, clone profiles or external services."""
    request = validate_speech_request(payload)
    executable = shutil.which('espeak')
    if not executable:
        raise RuntimeError('local_speech_engine_unavailable')
    with tempfile.TemporaryDirectory(prefix='atlas-native-speech-') as directory:
        output = Path(directory) / 'generic.wav'
        subprocess.run([
            executable,
            '-v', request['voice'],
            '-s', str(request['speechRate']),
            '-w', str(output),
            '--stdin',
        ], input=request['text'], text=True, stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL, check=True, timeout=35)
        size = output.stat().st_size
        if not 44 < size <= MAX_AUDIO_BYTES:
            raise RuntimeError('speech_output_invalid')
        audio = output.read_bytes()
        if not audio.startswith(b'RIFF') or audio[8:12] != b'WAVE':
            raise RuntimeError('speech_output_invalid')
        return audio
