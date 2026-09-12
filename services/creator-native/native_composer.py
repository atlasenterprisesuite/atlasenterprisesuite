from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any

_ALLOWED_RATIOS = {
    '9:16': (1080, 1920),
    '16:9': (1920, 1080),
    '1:1': (1080, 1080),
}
_ALLOWED_LOCAL_PROVIDERS = {None, '', 'atlas-native'}


def validate_request(payload: dict[str, Any]) -> dict[str, Any]:
    script = str(payload.get('script') or '').strip()
    if not script:
        raise ValueError('script_required')
    ratio = str(payload.get('aspectRatio') or '9:16')
    if ratio not in _ALLOWED_RATIOS:
        raise ValueError('aspect_ratio_unsupported')
    provider = payload.get('provider')
    if provider not in _ALLOWED_LOCAL_PROVIDERS:
        raise ValueError('external_provider_forbidden')
    rate = int(payload.get('speechRate') or 190)
    if rate < 100 or rate > 300:
        raise ValueError('speech_rate_invalid')
    return {
        **payload,
        'script': script,
        'aspectRatio': ratio,
        'provider': 'atlas-native',
        'voice': str(payload.get('voice') or 'es-la'),
        'speechRate': rate,
        'captions': list(payload.get('captions') or []),
    }


def _require_binary(name: str) -> str:
    path = shutil.which(name)
    if not path:
        raise RuntimeError(f'{name}_not_available')
    return path


def _probe_duration(path: Path) -> float:
    raw = subprocess.check_output([
        _require_binary('ffprobe'), '-v', 'error', '-show_entries',
        'format=duration', '-of', 'default=nw=1:nk=1', str(path)
    ], text=True).strip()
    return max(float(raw), 0.25)


def _srt_timestamp(seconds: float) -> str:
    total_ms = max(0, round(seconds * 1000))
    hours, rem = divmod(total_ms, 3_600_000)
    minutes, rem = divmod(rem, 60_000)
    secs, ms = divmod(rem, 1000)
    return f'{hours:02d}:{minutes:02d}:{secs:02d},{ms:03d}'


def _write_srt(captions: list[dict[str, Any]], path: Path, duration: float) -> None:
    if not captions:
        return
    blocks: list[str] = []
    for index, caption in enumerate(captions, 1):
        text = str(caption.get('text') or '').strip()
        if not text:
            continue
        start = max(0.0, float(caption.get('start') or 0.0))
        end = min(duration, float(caption.get('end') or duration))
        if end <= start:
            continue
        blocks.append(
            f'{index}\n{_srt_timestamp(start)} --> {_srt_timestamp(end)}\n{text}\n'
        )
    path.write_text('\n'.join(blocks), encoding='utf-8')


def render_video(payload: dict[str, Any], output_path: str | Path) -> dict[str, Any]:
    request = validate_request(payload)
    ffmpeg = _require_binary('ffmpeg')
    espeak = _require_binary('espeak')
    width, height = _ALLOWED_RATIOS[request['aspectRatio']]
    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix='atlas-native-') as tmp_name:
        tmp = Path(tmp_name)
        voice_path = tmp / 'voice.wav'
        srt_path = tmp / 'captions.srt'

        subprocess.run([
            espeak,
            '-v', request['voice'],
            '-s', str(request['speechRate']),
            '-p', '43',
            '-a', '185',
            '-w', str(voice_path),
            request['script'],
        ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        duration = _probe_duration(voice_path)
        _write_srt(request['captions'], srt_path, duration)

        video_filters = [
            f"drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text='ATLAS  •  NATIVE COMPOSER':fontcolor=white@0.72:fontsize={max(24, width // 34)}:x=(w-text_w)/2:y={max(48, height // 20)}"
        ]
        if srt_path.exists() and srt_path.stat().st_size:
            video_filters.append(
                f"subtitles={srt_path}:force_style='FontName=DejaVu Sans,FontSize=9,PrimaryColour=&H00FFFFFF,OutlineColour=&HAA000000,BorderStyle=1,Outline=1.5,Shadow=0,Alignment=2,MarginV=180,MarginL=70,MarginR=70,Bold=1'"
            )
        vf = ','.join(video_filters)

        cmd = [
            ffmpeg, '-loglevel', 'error', '-y',
            '-f', 'lavfi', '-i', f'color=c=#071526:s={width}x{height}:r=30:d={duration:.3f}',
            '-i', str(voice_path),
            '-f', 'lavfi', '-t', f'{duration:.3f}', '-i', 'sine=frequency=82:sample_rate=44100',
            '-filter_complex',
            f"[0:v]{vf}[v];[1:a]volume=1.0[voice];[2:a]volume=0.018,lowpass=f=420[music];[voice][music]amix=inputs=2:duration=first[a]",
            '-map', '[v]', '-map', '[a]', '-t', f'{duration:.3f}',
            '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p', '-r', '30',
            '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', str(output)
        ]
        subprocess.run(cmd, check=True)

    return {
        'ok': True,
        'provider': 'atlas-native',
        'billingClass': 'zero-cost',
        'execution': 'self-hosted',
        'output': str(output),
        'durationSeconds': round(duration, 3),
        'aspectRatio': request['aspectRatio'],
        'width': width,
        'height': height,
        'audio': True,
    }


def readiness() -> dict[str, Any]:
    ffmpeg = shutil.which('ffmpeg')
    ffprobe = shutil.which('ffprobe')
    espeak = shutil.which('espeak')
    ready = bool(ffmpeg and ffprobe and espeak)
    return {
        'ok': True,
        'service': 'atlas-native-composer',
        'state': 'ready' if ready else 'resource-blocked',
        'billingClass': 'zero-cost',
        'execution': 'self-hosted',
        'capabilities': ['script-to-video', 'local-tts', 'burned-captions', 'audio-mix'],
        'dependencies': {
            'ffmpeg': bool(ffmpeg),
            'ffprobe': bool(ffprobe),
            'espeak': bool(espeak),
        },
    }


if __name__ == '__main__':
    print(json.dumps(readiness(), ensure_ascii=False))
