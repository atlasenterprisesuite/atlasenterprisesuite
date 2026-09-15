# ATLAS Cloudflare production verification

This document separates provider deployment evidence from public-edge HTTP accessibility so ATLAS does not confuse Cloudflare bot mitigation with an application failure.

## Evidence states

| State | Meaning | Deployment claim allowed? | Required action |
| --- | --- | --- | --- |
| `passed` | Cloudflare provider build succeeded and either the GitHub runner received HTTP 200 on all public shell routes or the scoped ATLAS authorized runtime verifier confirmed those routes while preserving the protected deployment path. | Yes: production HTTP verified. | Keep monitoring. |
| `blocked_by_edge_challenge` | Cloudflare provider build succeeded, the GitHub runner received `403` with `cf-mitigated: challenge`, and the authorized ATLAS runtime verifier did not independently confirm the required routes. | Partial only: provider deployment verified; production HTTP proof incomplete. | Inspect edge policy or verifier health. |
| `failed` | Provider build failed, application gates failed, or a route returned a non-classified failure. | No. | Repair application or infrastructure. |

## Verification model

ATLAS deliberately keeps two independent signals:

1. **GitHub external probe** — detects what an untrusted automation runner sees at the public edge.
2. **ATLAS authorized runtime verifier** — a Supabase-hosted verification plane callable only by a GitHub OIDC token scoped to this repository, `main`, and `.github/workflows/cloudflare-deploy.yml`.

When Cloudflare challenges the GitHub runner, the workflow does not weaken zone-wide security. It requests a short-lived GitHub OIDC token with audience `atlas-production-http-verifier` and asks `atlas-cloudflare-production-http-verify` to verify:

- `/` returns HTTP 200;
- `/identity?app=/finance` returns HTTP 200;
- `/finance` returns HTTP 200;
- `/deployment.json` remains protected with HTTP 302, 401, or 403.

The verifier returns no credentials or provider secrets. Module authorization remains enforced by ATLAS Identity plus backend bearer/RBAC/RLS controls.

## ATLAS rule

ATLAS may report `production HTTP verified` only when the public shell receives HTTP 200 from the GitHub probe **or** the scoped authorized runtime verifier confirms the required routes and protected deployment boundary. A Cloudflare challenge against generic automation is retained as separate evidence (`github_edge_challenge_detected`) rather than treated as an application outage.

## Security posture

Do not disable Cloudflare security globally merely to make CI probes green. Browser Integrity Check remains independent, Security Level remains an edge control, and any future WAF exception must be narrowly scoped. Cloudflare API tokens must remain encrypted secrets, never Actions Variables.
