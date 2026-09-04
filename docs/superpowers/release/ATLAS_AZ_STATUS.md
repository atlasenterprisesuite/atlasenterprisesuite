# ATLAS A-Z Release Status

Updated: 2026-09-04
Release branch: `release/atlas-a-z`
Master PR: #13

## Current phase

Wave 0/1: Core + Accounting convergence.

## Completed

- Created isolated A-Z release branch from production `main`.
- Added umbrella A-Z closure architecture and execution program.
- Opened master draft PR #13 to keep partial work out of production.
- Absorbed the verified PR #8 Core + Accounting tree as a traceable merge parent while preserving newer production workflows, `/healthz`, data, Health/MiFi plans, and A-Z program documents.
- Preserved the current Accounts Payable regression tests alongside the richer Accounting test suite.
- Generated and committed a synchronized npm lockfile for the converged dependency graph.

## Active gate

Run the complete pull-request CI matrix against the synchronized release head. Any failure is treated as a release-branch compatibility regression and is fixed before additional domains are accepted.

## Production policy

`main` remains unchanged until the complete A-Z release gate is green. No partial A-Z production deployment is authorized by this release program.
