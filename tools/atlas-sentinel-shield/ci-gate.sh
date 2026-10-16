#!/usr/bin/env bash
# Mandatory ATLAS 777 P0 gate: detect new/changed embedded credentials.
set -euo pipefail

CHANGES="${RUNNER_TEMP:-/tmp}/atlas-security-changes.nul"
REPORT="${RUNNER_TEMP:-/tmp}/atlas-security-changed-report.json"
BASE_SHA="${BASE_SHA:-}"
if [[ "$BASE_SHA" == "0000000000000000000000000000000000000000" ]]; then
  BASE_SHA=""
fi

if [[ -n "$BASE_SHA" ]]; then
  git cat-file -e "$BASE_SHA^{commit}" || {
    echo "::error::Cannot resolve comparison SHA. Fail closed."
    exit 1
  }
  git diff --name-only --diff-filter=ACMR -z "$BASE_SHA" "$GITHUB_SHA" > "$CHANGES"
else
  git ls-files -z > "$CHANGES"
fi

set +e
python3 tools/atlas-sentinel-shield/sentinel.py . --files-from "$CHANGES" --output "$REPORT"
scan_rc=$?
set -e

# Never claim success if the scanner errored or did not produce a valid report.
python3 -m json.tool "$REPORT" >/dev/null
python3 - "$REPORT" <<'PY'
import json
import sys
from pathlib import Path
report = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
if report.get("tool") != "ATLAS Sentinel Shield":
    raise SystemExit("Invalid Sentinel report")
print("ATLAS Sentinel changed-source results:", report["counts"])
for finding in report["findings"]:
    if finding["severity"] == "P0":
        print(f"::error file={finding['file']},line={finding['line']}::P0: {finding['rule']}. Rotate/revoke real credentials.")
PY

if [[ "$scan_rc" -ne 0 ]]; then
  echo "::error::ATLAS Sentinel required P0 gate failed (scanner exit $scan_rc)."
  exit 1
fi
