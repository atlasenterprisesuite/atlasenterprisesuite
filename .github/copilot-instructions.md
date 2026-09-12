# ATLAS Copilot Repository Instructions

This repository is the operational source of truth for ATLAS Enterprise Suite: `atlasenterprisesuite/atlasenterprisesuite`.

Before changing a subsystem, read the applicable approved design/spec/plan plus `docs/governance/ATLAS_CANONICAL_REPOSITORY.md` and `docs/architecture/ATLAS_MANAGER_SPEC.md` when infrastructure or deployment is involved.

Use isolated feature branches and pull requests. Treat `main` as production-stable. Reuse existing routes, shared components, tenant scope, RBAC, audit, provider adapters, data contracts, and stronger existing implementations before creating anything parallel.

Never fabricate production, provider, financial, clinical, deployment, connectivity, readiness, or verification state. Repository state, CI state, deployment state, runtime health, provider connectivity, and public production verification are separate facts.

Never expose or commit credentials, tokens, private keys, or secret values. Report missing authorization precisely and continue independent work when possible.

Use real tests, typecheck, build, and existing CI gates. Do not weaken assertions or remove verification merely to make a change pass.

For UI/reference-image work, follow the approved ATLAS sequence: IMAGE -> ANALYSIS -> CLASSIFICATION -> EXISTING ATLAS -> ARCHITECTURE -> MODULE -> ROUTE -> NAVIGATION -> COMPONENTS -> DATA -> PERMISSIONS -> FUNCTIONS -> TESTS -> COMMIT -> DEPLOY -> VERIFICATION.

Do not leave fake buttons, `href="#"`, console-only actions, invented metrics, or false `Live`, `Connected`, `Ready`, or `100% functional` labels.
