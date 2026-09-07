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
- Primary backend/control plane: Supabase `atlas-core` (`ggmanzcgtlrvqfoccgsh`)
- Primary public edge target: Cloudflare

The previously referenced `winderaranguren-gif/Atlas-enterprise-suite` repository is legacy/historical and is **not a blocker** for current ATLAS development. If access returns, unique work is reconciled through comparison and auditable integration; canonical history is not force-replaced.

## Operating rule

ATLAS advances continuously through analysis, implementation, correction, testing, integration, deployment gates, and verification. Work stops only when a real human, legal, authorization, or technically irresolvable dependency makes further progress impossible. Independent work continues even when another dependency is blocked.

ATLAS Manager is the shared infrastructure control plane and deployment brain for the required GitHub → Supabase → Cloudflare → Production path. Vercel and other deployment providers are optional adapters unless an approved release explicitly marks them required. Provider-specific deployment mechanisms must converge through ATLAS Manager instead of becoming isolated sources of infrastructure truth.

## Truthful production state

Code, validation, deployment, runtime, provider authorization, public-edge routing, and public production verification are tracked separately. Provider-dependent capabilities never claim `live`, `online`, `connected`, `ready`, or `verified` status without evidence.

A successful build/readiness workflow means the canonical source passed its software gates. It does **not** by itself mean that Cloudflare has deployed the artifact or that the public ATLAS domains are serving that build.

## Long-term repository layout

Because this repository name matches the GitHub account name, GitHub also treats it as the profile repository. The preferred future dedicated product repository is `atlasenterprisesuite/atlas-enterprise-suite`. That migration is non-blocking; this repository remains the canonical source until the new repository exists and migration is explicitly verified.
