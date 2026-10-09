# ATLAS Sentinel Shield v0.1

Read-only source-code security scanner. This is **not** an antivirus, EDR, WAF, or proof of production security.

Run locally:

```sh
python3 -m unittest discover -s tools/atlas-sentinel-shield -p 'test_*.py'
python3 tools/atlas-sentinel-shield/sentinel.py . --output sentinel-report.json
```

The GitHub Actions workflow runs in **advisory mode** until baseline findings are triaged; it does not modify or deploy production. Findings report file, line and rule, never matched secret values. P0 causes a nonzero local exit status. Review findings before deciding which rules to enforce in CI. A pattern match is not automatically an exploitable vulnerability.

Known limitations: regex matching can generate false positives, miss obfuscated secrets, and does not test runtime authorization or malware. Integrate with CodeQL, dependency scanning, Supabase advisors, least privilege, incident response, backups and EDR for layered defense. Do not store production credentials in this repository.
