from __future__ import annotations

import hashlib
import json
import math
import subprocess
from pathlib import Path


def inspect_video(path: str | Path, *, organization_id: str, max_bytes: int = 100_000_000) -> dict:
    """Local-only inspection; no upload, tenant authorization or persistence."""
    if not organization_id or not organization_id.strip():
        raise ValueError("organization_required")
    source = Path(path)
    if not source.is_file() or source.is_symlink():
        raise ValueError("invalid_source")
    size = source.stat().st_size
    if size <= 0 or size > max_bytes:
        raise ValueError("invalid_source_size")
    if source.suffix.lower() != ".mp4":
        raise ValueError("unsupported_format")
    digest = hashlib.sha256()
    with source.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    from native_composer import _require_binary
    probe = subprocess.run(
        [_require_binary("ffprobe"), "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=codec_name,width,height:format=duration",
         "-of", "json", str(source)],
        capture_output=True, text=True, timeout=20, check=True,
    )
    metadata = json.loads(probe.stdout)
    streams = metadata.get("streams") or []
    duration = float((metadata.get("format") or {}).get("duration") or 0)
    if not streams or not math.isfinite(duration) or duration <= 0:
        raise ValueError("invalid_video_metadata")
    video = streams[0]
    if video.get("codec_name") not in {"h264", "hevc", "av1", "vp9"}:
        raise ValueError("unsupported_video_codec")
    return {
        "organizationId": organization_id,
        "sha256": digest.hexdigest(),
        "durationSeconds": duration,
        "width": int(video["width"]),
        "height": int(video["height"]),
        "status": "unverified",
    }
