"""Regression checks for wildcard CORS token boundaries in Sentinel Shield."""
import importlib.util
import pathlib
import unittest

SCANNER = pathlib.Path(__file__).resolve().parents[2] / "tools" / "atlas-sentinel-shield" / "sentinel.py"
spec = importlib.util.spec_from_file_location("atlas_sentinel_shield", SCANNER)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
RULE = next(pattern for _, name, pattern, _ in module.RULES if name == "WILDCARD_CORS")

class WildcardCorsRegressionTests(unittest.TestCase):
    def test_detects_actual_wildcard(self):
        for value in ("Access-Control-Allow-Origin: *", 'Access-Control-Allow-Origin: "*"', "Access-Control-Allow-Origin: '*'"):
            with self.subTest(value=value):
                self.assertIsNotNone(RULE.search(value))

    def test_does_not_flag_prefix_tokens(self):
        for value in ("Access-Control-Allow-Origin: *evil.com", "Access-Control-Allow-Origin: **", "Access-Control-Allow-Origin: *-example", "Access-Control-Allow-Origin: https://example.com"):
            with self.subTest(value=value):
                self.assertIsNone(RULE.search(value))

if __name__ == "__main__":
    unittest.main()
