# Contributing to ATLAS Enterprise Suite

## Canonical workflow

`atlasenterprisesuite/atlasenterprisesuite` and branch `main` are the canonical source of truth. Create a focused branch from current `main`, inspect existing architecture before adding a new source of truth, and integrate through a pull request.

## Development contract

1. Preserve tenant isolation, authentication, RBAC, auditability and provider truth.
2. Do not add fake metrics, fake connected states, placeholder actions or credentials.
3. Use test-driven development for behavior changes: add a failing test, verify RED, implement the smallest correct change, then verify GREEN.
4. Prefer existing modules, services, tables, APIs and routes over duplicate implementations.
5. Keep commits coherent and reviewable. Do not bulk-merge historical A-Z work.

## Required verification

From the repository root:

```bash
npm ci
npm run verify:all
```

The pull request must also pass ATLAS Consensus CI and CodeQL. Production completion additionally requires the exact merged SHA to pass ATLAS Build + Production Readiness Gate and Cloudflare deployment/runtime evidence.

## Sensitive changes

Changes to `.github/workflows`, `worker`, `supabase`, identity/security/governance, execution authority or provider integrations require explicit review of authorization boundaries and failure states. Secrets belong in provider/GitHub secret stores, never in source.

## Historical work

Historical branches and large integration pull requests are salvage sources, not merge targets. Recover unique verified capability in small current-main-based pull requests, preserving stronger current implementations.
