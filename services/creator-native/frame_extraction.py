from __future__ import annotations

import hashlib
import subprocess
from pathlib import Path

from native_composer import _require_binary
from video_inspection import inspect_video


def extract_timestamped_frames(source: str | Path, output_dir: str | Path, *,
                               organization_id: str, interval_seconds: float = 1.0,
                               max_frames: int = 30) -> list[dict]:
    """Local-only frames; caller must authorize tenant and secure output directory."""
    if not (0.1 <= interval_seconds <= 60) or not (1 <= max_frames <= 120):
        raise ValueError("invalid_sampling_limits")
    metadata = inspect_video(source, organization_id=organization_id)
    root = Path(output_dir)
    if root.is_symlink() or (root.exists() and (not root.is_dir() or any(root.iterdir()))):
        raise ValueError("unsafe_output_directory")
    root.mkdir(parents=True, mode=0o700, exist_ok=True)
    root.chmod(0o700)
    duration = metadata["durationSeconds"]
    timestamps = []
    index = 0
    while index < max_frames and index * interval_seconds < duration:
        timestamps.append(round(index * interval_seconds, 3))
        index += 1
    frames = []
    for i, timestamp in enumerate(timestamps):
        dest = root / f"frame-{i:04d}.jpg"
        try:
            subprocess.run([_require_binary("ffmpeg"), "-hide_banner", "-loglevel", "error",
                            "-nostdin", "-ss", str(timestamp), "-i", str(source),
                            "-frames:v", "1", "-an", "-y", str(dest)],
                           check=True, capture_output=True, timeout=30)
            if not dest.is_file() or dest.stat().st_size == 0:
                raise ValueError("frame_extraction_failed")
            dest.chmod(0o600)
            frames.append({"timestampSeconds": timestamp, "filename": dest.name,
                           "sha256": hashlib.sha256(dest.read_bytes()).hexdigest(),
                           "sourceSha256": metadata["sha256"],
                           "organizationId": organization_id})
        except Exception:
            for file in root.glob("frame-*.jpg"):
                file.unlink(missing_ok=True)
            raise
    return frames
