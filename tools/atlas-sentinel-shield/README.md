# ATLAS Sentinel Shield v0.1

Read-only source-code security scanner. This is **not** an antivirus, EDR, WAF, or proof of production security.

Run locally:

```sh
python3 -m unittest discover -s tools/atlas-sentinel-shield -p 'test_*.py'
python3 tools/atlas-sentinel-shield/sentinel.py . --output sentinel-report.json
```

The standalone Sentinel workflow remains **advisory for full-repository legacy findings** while those findings are triaged. **The required `github-security-baseline` PR check now enforces fail-closed P0 scanning of every added, copied, modified or renamed source file.** It compares the PR base commit and the tested checkout SHA, using a NUL-delimited Git path list. If that comparison cannot be established, the gate fails instead of claiming a clean result. Manual/initial runs scan all tracked files.

Findings report file, line and rule; never secret values. P0 matches cannot be suppressed with `sentinel:ignore`. The scanner also examines committed `.env`-style files, subject to its documented size limits. A match is not automatically an exploitable vulnerability.

Current required-rule caveat: the GitHub main ruleset requires `github-security-baseline`, not the separate advisory Sentinel workflow. Production is not considered verified merely because this gate passes. Changes to repository visibility, protected branch review requirements, or provider credentials are separate privileged actions and must be verified in GitHub.

Known limitations: regex matching can generate false positives, miss obfuscated secrets, and does not test runtime authorization or malware. Integrate with CodeQL, dependency scanning, Supabase advisors, least privilege, incident response, backups and EDR for layered defense. Do not store production credentials in this repository.
