# ATLAS Sentinel Shield v0.1

Read-only source-code security scanner. This is **not** an antivirus, EDR, WAF, or proof of production security.

Run locally:

```sh
python3 -m unittest discover -s tools/atlas-sentinel-shield -p 'test_*.py'
python3 tools/atlas-sentinel-shield/sentinel.py . --output sentinel-report.json
```

The standalone Sentinel workflow remains **advisory for full-repository legacy findings** while those findings are triaged. **The required `verify-build-readiness` PR check now enforces fail-closed P0 scanning of every added, copied, modified or renamed source file.** It compares the PR base commit and the tested checkout SHA, using a NUL-delimited Git path list. If that comparison cannot be established, the gate fails instead of claiming a clean result. Manual/initial runs scan all tracked files.

Findings report file, line and rule; never secret values. P0 matches cannot be suppressed with `sentinel:ignore`. The scanner also examines committed `.env`-style files, subject to its documented size limits. A match is not automatically an exploitable vulnerability.

The GitHub main ruleset requires both `verify-build-readiness` (which enforces the changed-file P0 gate) and `github-security-baseline` (the independently preserved security baseline). The standalone Sentinel workflow remains advisory for legacy findings. Production is not considered verified merely because this gate passes. Changes to repository visibility, protected branch review requirements, or provider credentials are separate privileged actions and must be verified in GitHub.

Known limitations: regex matching can generate false positives, miss obfuscated secrets, and does not test runtime authorization or malware. Integrate with CodeQL, dependency scanning, Supabase advisors, least privilege, incident response, backups and EDR for layered defense. Do not store production credentials in this repository.

## Additional credential detectors (2026-11-21 draft)

Changed-file P0 scanning also checks for token-shaped GitHub legacy and fine-grained access tokens (`ghp_`, `gho_`, `ghu_`, `ghs_`, `ghr_`, `github_pat_`) and AWS access key IDs (`AKIA` / `ASIA`). Synthetic token-shaped fixtures exercise positive and negative cases; no real credentials are committed. A match is a **potential exposure requiring triage**, not proof of exploitability. The scanner reports only path, line, rule and recommended action; it never emits matched credential values.

Detection is intentionally bounded: generic passwords, browser session stores, encrypted vault contents, live endpoints, git history outside the tested checkout, AI agent tool logs, and unrecognized token formats are **not** exhaustively covered. Do not upload or paste real credentials into issues, PRs or logs. A suspected leak requires confidential incident review, revocation/rotation and provider-side audit. The PR gate cannot prove the endpoint or production environment is clean.
