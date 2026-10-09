import tempfile
import unittest
from pathlib import Path
from sentinel import scan

class SentinelTests(unittest.TestCase):
    def test_secret_redacted(self):
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / "bad.ts").write_text('const key="sb_secret_EXAMPLE01234567890";')
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
            p.write_text("sb_secret_EXAMPLE01234567890")
            self.assertEqual(scan(Path(d))["files_scanned"], 0)

if __name__ == "__main__":
    unittest.main()
