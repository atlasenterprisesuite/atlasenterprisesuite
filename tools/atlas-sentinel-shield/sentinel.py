#!/usr/bin/env python3
"""ATLAS Sentinel Shield: read-only source scanner. No secrets in output."""
import argparse
import json
import re
import sys
from pathlib import Path

RULES = [
    ("P0", "SECRET_KEY", re.compile(r"(?i)sb_secret_[A-Za-z0-9_-]{12,}"), "Rotate secret and use secret manager"),
    ("P0", "SERVICE_ROLE_KEY", re.compile(r'(?i)(?:SUPABASE_SERVICE_ROLE_KEY|service_role_key)\s*[:=]\s*[A-Za-z0-9_.-]{20,}'), "Remove embedded privileged credentials"),
    ("P1", "WILDCARD_CORS", re.compile(r'''(?i)Access-Control-Allow-Origin\s*['"]?\s*[:=]\s*['"]\*'''), "Review authenticated CORS origins"),
    ("P1", "JWT_DISABLED", re.compile(r"(?m)^\s*verify_jwt\s*=\s*false\b"), "Confirm alternate authorization or intentionally public route"),
    ("P1", "RLS_DISABLED", re.compile(r"(?i)ALTER\s+TABLE\s+[^;\n]+\s+DISABLE\s+ROW\s+LEVEL\s+SECURITY"), "Keep RLS enabled for exposed tables"),
    ("P1", "SECURITY_DEFINER", re.compile(r"(?i)\bSECURITY\s+DEFINER\b"), "Review grants, search_path and tenant authorization"),
    ("P2", "EVAL", re.compile(r"\beval\s*\("), "Review dynamic execution"),
]
SKIP = {".git", "node_modules", "dist", "build", ".next", ".venv", "coverage"}
EXTS = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".sql", ".toml", ".py", ".json", ".yaml", ".yml"}

def scan(root):
    findings = []
    scanned = 0
    for p in root.rglob("*"):
        if not p.is_file() or any(x in SKIP for x in p.relative_to(root).parts[:-1]):
            continue
        if p.suffix.lower() not in EXTS or p.stat().st_size > 1_000_000:
            continue
        scanned += 1
        try:
            lines = p.read_text(encoding="utf-8").splitlines()
        except (UnicodeError, OSError):
            continue
        for line_number, line in enumerate(lines, 1):
            if "sentinel:ignore" in line:
                continue
            for severity, rule, pattern, advice in RULES:
                if pattern.search(line):
                    findings.append({"severity": severity, "rule": rule, "file": str(p.relative_to(root)), "line": line_number, "advice": advice})
    return {"tool": "ATLAS Sentinel Shield", "mode": "read-only", "files_scanned": scanned,
            "findings": findings, "counts": {s: sum(f["severity"] == s for f in findings) for s in ("P0", "P1", "P2")}}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("repository", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    root = args.repository.resolve()
    if not root.is_dir():
        parser.error("repository must be a directory")
    result = scan(root)
    payload = json.dumps(result, indent=2)
    if args.output:
        args.output.write_text(payload + "\n", encoding="utf-8")
    else:
        print(payload)
    return 2 if result["counts"]["P0"] else 0

if __name__ == "__main__":
    sys.exit(main())
