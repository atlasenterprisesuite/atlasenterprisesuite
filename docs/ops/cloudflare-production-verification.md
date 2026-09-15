# ATLAS Cloudflare production verification

This document separates the production deployment evidence states so ATLAS does not confuse provider deployment success with public-edge HTTP accessibility.

## Evidence states

| State | Meaning | Deployment claim allowed? | Required action |
| --- | --- | --- | --- |
| `passed` | Cloudflare provider build succeeded and public routes returned HTTP 200 from GitHub Actions. | Yes: production HTTP verified. | Keep monitoring. |
| `blocked_by_edge_challenge` | Cloudflare provider build succeeded, but the public hostname returned `403` with `cf-mitigated: challenge` to the GitHub Actions verifier. | Partial only: provider deployment verified; public HTTP proof blocked by edge policy. | Configure a scoped Cloudflare bypass or token factory for the production verifier. |
| `failed` | Provider build failed, app tests failed, or public hostname returned a non-classified failure. | No. | Inspect workflow logs and repair app or infrastructure. |

## Why this matters

A Cloudflare browser challenge can block automated GitHub runners while the site is still accessible to a normal browser. The workflow must not report that the application is broken unless the response is a real app/deploy failure.

## ATLAS rule

ATLAS can only say `production HTTP verified` when all public shell probes return HTTP 200 or a scoped, authorized verification bypass confirms the routes. If the edge returns a Cloudflare challenge, ATLAS records the result honestly as `blocked_by_edge_challenge` and continues preserving build evidence.

## Pending Cloudflare configuration

To remove the challenge state, configure one of these controlled options:

1. A narrowly scoped Cloudflare WAF rule that bypasses browser challenge only for the GitHub Actions production verifier signal.
2. `CLOUDFLARE_TOKEN_FACTORY_TOKEN` so the workflow can create and revoke a temporary verification token.
3. A Cloudflare Access service token wired only to the production verification route checks.

Do not store Cloudflare API tokens as GitHub Actions Variables. Use encrypted GitHub Actions Secrets only.
