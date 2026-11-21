import tempfile
import unittest
from pathlib import Path
from sentinel import scan

class SentinelTests(unittest.TestCase):
    def test_secret_redacted(self):
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / "bad.ts").write_text('const key="' + "sb_" + "secret_EXAMPLE01234567890" + '";')
            result = scan(Path(d))
            self.assertEqual(result["counts"]["P0"], 1)
            self.assertNotIn("EXAMPLE01234567890", str(result))
    def test_clean(self):
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / "ok.ts").write_text("export const ok = true;")
            self.assertEqual(scan(Path(d))["findings"], [])
    def test_detects_wildcard_cors_without_reporting_non_wildcard_origins(self):
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / "headers.ts").write_text(
                'Access-Control-Allow-Origin: "*"\nAccess-Control-Allow-Origin: *\n'
                'Access-Control-Allow-Origin: https://example.test'
            )
            result = scan(Path(d))
            rules = [item["rule"] for item in result["findings"]]
            self.assertEqual(rules.count("WILDCARD_CORS"), 2)
            self.assertEqual(result["counts"]["P0"], 0)

    def test_skip_node_modules(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "node_modules" / "bad.ts"
            p.parent.mkdir()
            p.write_text("sb_" + "secret_EXAMPLE01234567890")
            self.assertEqual(scan(Path(d))["files_scanned"], 0)

    def test_p0_ignore_is_not_a_bypass(self):
        with tempfile.TemporaryDirectory() as d:
            key = "sb_" + "secret_EXAMPLE01234567890"
            (Path(d) / "danger.ts").write_text("const key='" + key + "'; // sentinel:ignore")
            result = scan(Path(d))
            self.assertEqual(result["counts"]["P0"], 1)

    def test_selected_files_only_enforce_changed_sources(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            key = "sb_" + "secret_EXAMPLE01234567890"
            (root / "unchanged.ts").write_text("const key='" + key + "';")
            (root / "changed.ts").write_text("export const safe = true;")
            self.assertEqual(scan(root, [Path("changed.ts")])["counts"]["P0"], 0)
            self.assertEqual(scan(root)["counts"]["P0"], 1)

    def test_env_files_are_scanned(self):
        with tempfile.TemporaryDirectory() as d:
            key = "sb_" + "secret_EXAMPLE01234567890"
            (Path(d) / ".env.production").write_text("TOKEN=" + key)
            self.assertEqual(scan(Path(d), [Path(".env.production")])["counts"]["P0"], 1)

    def test_selected_file_cannot_escape_repository(self):
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaises(ValueError):
                scan(Path(d), [Path("../outside.ts")])

    def test_p1_ignore_does_not_hide_p0_on_same_line(self):
        with tempfile.TemporaryDirectory() as d:
            key = "sb_" + "secret_EXAMPLE01234567890"
            (Path(d) / "mixed.ts").write_text("const key='" + key + "'; // sentinel:ignore")
            findings = scan(Path(d))["findings"]
            self.assertTrue(any(f["rule"] == "SECRET_KEY" for f in findings))


    def test_detects_github_and_aws_tokens_without_exposing_values(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            tokens = [
                "gh" + "p_" + "A" * 36,
                "github_" + "pat_" + "B" * 28,
                "AK" + "IA" + "C" * 16,
                "AS" + "IA" + "D" * 16,
            ]
            (root / "leaked.env").write_text("\n".join(tokens), encoding="utf-8")
            result = scan(root, [Path("leaked.env")])
            self.assertEqual(result["counts"]["P0"], 4)
            self.assertEqual(
                {finding["rule"] for finding in result["findings"]},
                {"GITHUB_LEGACY_TOKEN", "GITHUB_FINE_GRAINED_TOKEN", "AWS_ACCESS_KEY_ID"},
            )
            for token in tokens:
                self.assertNotIn(token, str(result))

    def test_does_not_flag_short_placeholder_credentials(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            (root / "example.env").write_text(
                "GITHUB_TOKEN=gh" + "p_example\nAWS_KEY=AK" + "IAEXAMPLE",
                encoding="utf-8",
            )
            self.assertEqual(scan(root)["counts"]["P0"], 0)

if __name__ == "__main__":
    unittest.main()
