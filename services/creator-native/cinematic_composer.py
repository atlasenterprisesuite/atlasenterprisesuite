"""ATLAS Cinematic Engine 777: offline, fail-closed timeline compositor.

No network, model inference, publication, remote provider fallback or user-supplied
filesystem paths. Only an authorized operator may stage media into asset_root.
The service/API transport and tenant-safe asset staging are NOT enabled here.
"""
from __future__ import annotations

import json
import math
from pathlib import Path
import shutil
import subprocess
import tempfile
from typing import Any

IMAGES = frozenset({'.png', '.jpg', '.jpeg', '.webp'})
VIDEOS = frozenset({'.mp4', '.mov'})
AUDIOS = frozenset({'.wav', '.mp3', '.m4a', '.flac'})
SIZES = frozenset({(360, 640), (720, 1280), (1080, 1920)})


def secure_asset(root: Path, filename: Any, extensions: frozenset[str]) -> Path:
    if not isinstance(filename, str) or not filename or filename in {'.', '..'}:
        raise ValueError('invalid_asset_name')
    if '/' in filename or chr(92) in filename or chr(0) in filename or filename != Path(filename).name:
        raise ValueError('invalid_asset_name')
    if Path(filename).suffix.lower() not in extensions:
        raise ValueError('unsupported_asset_type')
    root_real = root.resolve(strict=True)
    candidate = root_real / filename
    if candidate.is_symlink() or not candidate.is_file() or candidate.resolve() != candidate:
        raise ValueError('missing_or_unsafe_asset')
    if candidate.stat().st_size <= 0:
        raise ValueError('empty_asset')
    return candidate


def validate_spec(spec: Any, assets: Path) -> dict:
    if not isinstance(spec, dict):
        raise ValueError('invalid_spec')
    size = spec.get('size', [1080, 1920])
    if not isinstance(size, list) or len(size) != 2 or any(type(v) is not int for v in size):
        raise ValueError('invalid_size')
    width, height = size
    if (width, height) not in SIZES:
        raise ValueError('unsupported_size')
    fps = spec.get('fps', 30)
    if type(fps) is not int or fps not in {24, 25, 30}:
        raise ValueError('unsupported_fps')
    scenes = spec.get('scenes')
    if not isinstance(scenes, list) or not (1 <= len(scenes) <= 24):
        raise ValueError('invalid_scenes')
    dissolve = spec.get('dissolve', 0.35)
    if isinstance(dissolve, bool) or not isinstance(dissolve, (int, float)) or not math.isfinite(dissolve) or not (0 <= dissolve <= 0.75):
        raise ValueError('invalid_dissolve')
    safe = []
    for index, scene in enumerate(scenes):
        if not isinstance(scene, dict):
            raise ValueError(f'invalid_scene_{index}')
        path = secure_asset(assets, scene.get('media'), IMAGES | VIDEOS)
        duration = scene.get('duration')
        if isinstance(duration, bool) or not isinstance(duration, (int, float)) or not math.isfinite(duration) or not (0.7 <= duration <= 30):
            raise ValueError(f'invalid_duration_{index}')
        motion = scene.get('motion', 'push')
        if motion not in {'push', 'pull', 'still'}:
            raise ValueError(f'invalid_motion_{index}')
        safe.append({'path': path, 'duration': float(duration), 'motion': motion})
    if len(safe) > 1 and any(s['duration'] <= dissolve + 0.4 for s in safe):
        raise ValueError('dissolve_exceeds_scene')
    total = sum(s['duration'] for s in safe) - dissolve * (len(safe) - 1)
    if total > 180:
        raise ValueError('timeline_too_long')
    voice = secure_asset(assets, spec['voice'], AUDIOS) if spec.get('voice') else None
    soundbed = secure_asset(assets, spec['soundbed'], AUDIOS) if spec.get('soundbed') else None
    captions = secure_asset(assets, spec['captions'], frozenset({'.srt'})) if spec.get('captions') else None
    return {'size': (width, height), 'fps': fps, 'scenes': safe, 'dissolve': float(dissolve),
            'total': total, 'voice': voice, 'soundbed': soundbed, 'captions': captions}


def binary(name: str) -> str:
    executable = shutil.which(name)
    if not executable:
        raise RuntimeError(f'{name}_not_available')
    return executable


def _run(argv: list[str]) -> None:
    subprocess.run(argv, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=180)


def _segment(path: Path, dest: Path, duration: float, width: int, height: int, fps: int, motion: str) -> None:
    if path.suffix.lower() in IMAGES:
        zoom = 'min(zoom+0.0009,1.16)' if motion == 'push' else 'max(zoom-0.0009,1.0)' if motion == 'pull' else '1.0'
        vf = f"scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},zoompan=z='{zoom}':d=1:s={width}x{height}:fps={fps},setsar=1,format=yuv420p"
        inp = ['-loop', '1', '-framerate', str(fps), '-i', str(path)]
    else:
        vf = f'fps={fps},scale={width}:{height}:force_original_aspect_ratio=increase,crop={width}:{height},setsar=1,format=yuv420p'
        inp = ['-stream_loop', '-1', '-i', str(path)]
    _run([binary('ffmpeg'), '-hide_banner', '-loglevel', 'error', '-nostdin', '-y', *inp,
          '-t', f'{duration:.3f}', '-vf', vf, '-an', '-c:v', 'libx264', '-preset', 'ultrafast',
          '-crf', '22', '-pix_fmt', 'yuv420p', '-r', str(fps), str(dest)])


def render(spec: dict, assets: Path, output: Path) -> dict:
    """Offline render. Deliberately NOT exposed by the production HTTP service."""
    cfg = validate_spec(spec, assets)
    ffmpeg = binary('ffmpeg')
    binary('ffprobe')
    output = output.absolute()
    if output.is_symlink():
        raise ValueError('unsafe_output')
    if output.suffix.lower() != '.mp4':
        raise ValueError('invalid_output_type')
    if output.parent.resolve() == assets.resolve():
        raise ValueError('output_in_asset_root')
    output.parent.mkdir(parents=True, exist_ok=True)
    width, height = cfg['size']
    with tempfile.TemporaryDirectory(prefix='atlas-cinematic-777-') as temp:
        work = Path(temp)
        clips = []
        for index, scene in enumerate(cfg['scenes']):
            segment = work / f'scene_{index:02}.mp4'
            _segment(scene['path'], segment, scene['duration'], width, height, cfg['fps'], scene['motion'])
            clips.append(segment)
        assembled = work / 'picture.mp4'
        if len(clips) == 1:
            shutil.copyfile(clips[0], assembled)
        elif not cfg['dissolve']:
            manifest = work / 'concat.txt'
            manifest.write_text(''.join(f"file '{p}'\n" for p in clips), encoding='utf-8')
            _run([ffmpeg, '-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-f', 'concat',
                  '-safe', '0', '-i', str(manifest), '-c', 'copy', str(assembled)])
        else:
            inputs = [v for clip in clips for v in ('-i', str(clip))]
            chains = []
            cumulative = cfg['scenes'][0]['duration']
            dissolve = cfg['dissolve']
            for j in range(1, len(clips)):
                left = '[0:v]' if j == 1 else f'[xf{j-1}]'
                offset = max(0.0, cumulative - dissolve)
                chains.append(f'{left}[{j}:v]xfade=transition=fade:duration={dissolve:.3f}:offset={offset:.3f}[xf{j}]')
                cumulative += cfg['scenes'][j]['duration'] - dissolve
            _run([ffmpeg, '-hide_banner', '-loglevel', 'error', '-nostdin', '-y', *inputs,
                  '-filter_complex', ';'.join(chains), '-map', f'[xf{len(clips)-1}]',
                  '-an', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '21',
                  '-pix_fmt', 'yuv420p', str(assembled)])
        argv = [ffmpeg, '-hide_banner', '-loglevel', 'error', '-nostdin', '-y', '-i', str(assembled)]
        filters = []
        if cfg['captions']:
            srt = work / 'captions.srt'
            shutil.copyfile(cfg['captions'], srt)
            filters.append(f"subtitles={srt}:force_style='FontName=DejaVu Sans,FontSize=8,Outline=2,Alignment=2,MarginV=35'")
        if cfg['voice']:
            argv.extend(['-i', str(cfg['voice'])])
        if cfg['soundbed']:
            argv.extend(['-i', str(cfg['soundbed'])])
        argv.extend(['-f', 'lavfi', '-t', f"{cfg['total']:.3f}", '-i', 'anullsrc=r=44100:cl=stereo'])
        audio = []
        index = 1
        if cfg['voice']:
            audio.append(f'[1:a]aresample=44100,apad,atrim=duration={cfg["total"]:.3f},volume=1.0[vox]')
            index += 1
        if cfg['soundbed']:
            audio.append(f'[{index}:a]aresample=44100,apad,atrim=duration={cfg["total"]:.3f},volume=0.16[bed]')
        silent = 1 + bool(cfg['voice']) + bool(cfg['soundbed'])
        a_inputs = ('[vox]' if cfg['voice'] else '') + ('[bed]' if cfg['soundbed'] else '') + f'[{silent}:a]'
        audio.append(f'{a_inputs}amix=inputs={1+bool(cfg["voice"])+bool(cfg["soundbed"])}:duration=longest:dropout_transition=0[a]')
        if filters:
            audio.insert(0, f'[0:v]{",".join(filters)}[v]')
        argv.extend(['-filter_complex', ';'.join(audio), '-map', '[v]' if filters else '0:v',
                     '-map', '[a]', '-t', f"{cfg['total']:.3f}", '-c:v',
                     'libx264' if filters else 'copy'])
        if filters:
            argv.extend(['-preset', 'ultrafast', '-pix_fmt', 'yuv420p'])
        argv.extend(['-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', str(output)])
        _run(argv)
    probe = json.loads(subprocess.check_output([binary('ffprobe'), '-v', 'error',
        '-show_entries', 'format=duration:stream=codec_name,width,height', '-of', 'json', str(output)], text=True))
    streams = probe.get('streams', [])
    if not any(x.get('codec_name') == 'h264' and (x.get('width'), x.get('height')) == cfg['size'] for x in streams):
        raise RuntimeError('invalid_video_output')
    if not any(x.get('codec_name') == 'aac' for x in streams):
        raise RuntimeError('invalid_audio_output')
    return {'ok': True, 'output': str(output), 'duration_seconds': float(probe['format']['duration']),
            'scene_count': len(clips), 'dimensions': list(cfg['size']), 'execution': 'offline',
            'published': False, 'generated_photorealistic_footage': False}
