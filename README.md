# ATLAS Enterprise Suite

**Operational canonical repository for ATLAS.**

ATLAS Enterprise Suite is the shared enterprise platform for people, finance, operations, security, communication, intelligence, health, mobility, productivity, and connected services.

## Repository authority

- Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`
- Production-stable branch: `main`
- A-Z integration branch: `release/atlas-a-z`
- Production URL: `https://www.atlasenterprisesuite.com`
- Governance: `docs/governance/ATLAS_CANONICAL_REPOSITORY.md`
- Infrastructure control plane: `docs/architecture/ATLAS_MANAGER_SPEC.md`
- Canonical backend: Supabase `atlas-core-v2` (`qawxltbplsxcjvwxdkes`)

The previously referenced `winderaranguren-gif/Atlas-enterprise-suite` repository is legacy/historical and is **not a blocker** for current ATLAS development. If access returns, unique work is reconciled through comparison and auditable integration; canonical history is not force-replaced.

## Operating rule

ATLAS advances continuously through analysis, implementation, correction, testing, integration, deployment gates, and verification. Work stops only when a real human, legal, authorization, or technically irresolvable dependency makes further progress impossible. Independent work continues even when another dependency is blocked.

ATLAS Manager is the shared infrastructure control plane and deployment brain for GitHub, ATLAS Forge, Supabase, Cloudflare, and production verification. Supabase is the primary backend/data/auth platform and Cloudflare is the primary web/edge/DNS delivery layer. Vercel is legacy compatibility only and is not a required production dependency under the current architecture directive.

## Truthful production state

Code, validation, backend verification, deployment, runtime, and public-edge verification are tracked separately. Provider-dependent capabilities never claim `live`, `online`, `connected`, or `verified` status without evidence.

The Supabase v2 Backend Gate can verify the data layer independently, but it does not replace full repository typecheck/tests/build, authenticated application E2E, or production route verification.

## Long-term repository layout

Because this repository name matches the GitHub account name, GitHub also treats it as the profile repository. The preferred future dedicated product repository is `atlasenterprisesuite/atlas-enterprise-suite`. That migration is non-blocking; this repository remains the canonical source until the new repository exists and migration is explicitly verified.
