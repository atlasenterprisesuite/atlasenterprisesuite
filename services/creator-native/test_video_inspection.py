from __future__ import annotations

import hashlib
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from frame_extraction import extract_timestamped_frames
from video_inspection import inspect_video


class VideoInspectionTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.video = self.root / "source.mp4"
        self.video.write_bytes(b"test video fixture")
        self.probe = {
            "streams": [{"codec_name": "h264", "width": 512, "height": 910}],
            "format": {"duration": "5.4"},
        }

    @patch("subprocess.run")
    @patch("native_composer._require_binary", return_value="/usr/bin/ffprobe")
    def test_metadata_digest_and_tenant(self, _binary, run):
        run.return_value.stdout = json.dumps(self.probe)
        result = inspect_video(self.video, organization_id="org-a")
        self.assertEqual(result["sha256"], hashlib.sha256(self.video.read_bytes()).hexdigest())
        self.assertEqual(result["organizationId"], "org-a")
        self.assertEqual(result["status"], "unverified")

    def test_missing_organization_rejected(self):
        with self.assertRaises(ValueError):
            inspect_video(self.video, organization_id="")

    def test_symlink_source_rejected(self):
        link = self.root / "link.mp4"
        link.symlink_to(self.video)
        with self.assertRaises(ValueError):
            inspect_video(link, organization_id="org-a")

    def test_sampling_bounds_rejected(self):
        with self.assertRaises(ValueError):
            extract_timestamped_frames(self.video, self.root / "out", organization_id="org-a", interval_seconds=0)

    def test_occupied_directory_rejected(self):
        out = self.root / "occupied"
        out.mkdir()
        (out / "unrelated.txt").write_text("do not delete")
        with patch("frame_extraction.inspect_video", return_value={"durationSeconds": 5.4, "sha256": "a" * 64}):
            with self.assertRaises(ValueError):
                extract_timestamped_frames(self.video, out, organization_id="org-a")
        self.assertTrue((out / "unrelated.txt").exists())

    @patch("frame_extraction.subprocess.run")
    @patch("frame_extraction._require_binary", return_value="/usr/bin/ffmpeg")
    @patch("frame_extraction.inspect_video")
    def test_timestamped_frames_and_source_reference(self, inspect, _binary, run):
        inspect.return_value = {"durationSeconds": 2.4, "sha256": "a" * 64}
        def fake_ffmpeg(argv, **kwargs):
            Path(argv[-1]).write_bytes(b"frame")
            return subprocess.CompletedProcess(argv, 0)
        run.side_effect = fake_ffmpeg
        frames = extract_timestamped_frames(self.video, self.root / "frames", organization_id="org-a")
        self.assertEqual([f["timestampSeconds"] for f in frames], [0, 1, 2])
        self.assertTrue(all(f["sourceSha256"] == "a" * 64 for f in frames))
        self.assertTrue(all(f["organizationId"] == "org-a" for f in frames))


if __name__ == "__main__":
    unittest.main()
