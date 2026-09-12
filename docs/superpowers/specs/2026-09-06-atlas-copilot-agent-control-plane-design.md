# ATLAS Copilot Agent Control Plane Design

## Status
Approved in chat on 2026-09-06. This design extends the approved `ATLAS Manager — Infrastructure Control Plane + Deployment Brain` architecture with a repository-native GitHub Copilot execution layer. It does not replace ATLAS Manager, ATLAS governance, or the external ChatGPT architecture/synthesis authority.

## Objective
Make the canonical ATLAS repository directly consumable by the GitHub Copilot app, Copilot cloud agent, Copilot CLI, and compatible agent surfaces so recurring ATLAS engineering rules, specialist roles, validation behavior, and provider integrations are encoded in versioned repository configuration instead of being re-explained in every session.

## Current Repository Findings
The operational canonical repository is `atlasenterprisesuite/atlasenterprisesuite` on `main`.

Existing architecture already provides:
- `docs/architecture/ATLAS_MANAGER_SPEC.md`
- `docs/governance/ATLAS_CANONICAL_REPOSITORY.md`
- `.github/workflows/` with ATLAS CI/deployment workflows
- `docs/superpowers/specs/` and `docs/superpowers/plans/`
- active feature/release branches and PR-based integration

The current `.github` directory contains workflows only. Repository-level Copilot agents, skills, and custom instructions are not yet present on `main`.

## Ownership and Classification
- Primary owner: `ATLAS Manager`
- Execution surface: GitHub Copilot app / Copilot cloud agent / Copilot CLI
- Secondary integrations: ATLAS Orchestrator, ATLAS Consensus, ATLAS Security, CI, deployment providers, future `atlas-mcp`
- Architecture and product authority: approved ATLAS specifications and governance; Copilot agents execute within those constraints and do not redefine them

## Architecture Decision
Adopt a repository-native control plane layered onto the existing ATLAS architecture.

```text
Approved ATLAS architecture / governance
                |
                v
.github/copilot-instructions.md
                |
        +-------+--------+
        |                |
.github/agents/      .github/skills/
        |                |
        +-------+--------+
                |
      GitHub Copilot runtime
                |
       isolated task branch
                |
     implementation / review / QA
                |
        existing GitHub CI
                |
            pull request
                |
          ATLAS Manager
                |
Vercel -> Cloudflare -> Supabase -> Production
```

This is the recommended option because it uses GitHub-supported repository conventions, works across GitHub Copilot surfaces, and avoids creating a parallel orchestration system.

## Alternatives Considered
### A. Repository-native agents + skills + instructions — selected
Pros: versioned with code, auditable, portable across supported Copilot surfaces, smallest new surface area, follows existing ATLAS repository governance.

### B. Organization-level `.github` repository only
Useful later when ATLAS has multiple product repositories, but premature while one operational repository remains canonical.

### C. Custom orchestration runtime replacing Copilot conventions
Rejected for this phase because ATLAS already has an orchestrator/consensus direction and GitHub provides native agent customization. Rebuilding that layer would duplicate functionality.

## Repository Layout
Target additions:

```text
.github/
├── copilot-instructions.md
├── agents/
│   ├── atlas-implementer.agent.md
│   ├── atlas-reviewer.agent.md
│   ├── atlas-qa.agent.md
│   ├── atlas-security.agent.md
│   └── atlas-deployment.agent.md
├── skills/
│   ├── atlas-master-command/
│   │   └── SKILL.md
│   ├── atlas-architecture/
│   │   └── SKILL.md
│   ├── atlas-testing/
│   │   └── SKILL.md
│   ├── atlas-manager/
│   │   └── SKILL.md
│   └── atlas-production-truth/
│       └── SKILL.md
└── workflows/
    └── existing workflows remain authoritative
```

Do not create a generic `.mcp/` directory merely to imitate MCP configuration. GitHub-supported MCP configuration should use repository Copilot settings and/or the `mcp-servers` property in custom agent profiles. ATLAS-owned MCP server implementation code, when required, belongs in the existing package/application architecture rather than an invented configuration folder.

## Global Copilot Instructions
`.github/copilot-instructions.md` is the compact repository-wide contract. It must direct Copilot to:

1. Treat `atlasenterprisesuite/atlasenterprisesuite` as the current operational source of truth.
2. Respect `main` as production-stable and use isolated feature branches/PRs for implementation.
3. Read applicable approved design/spec/plan documents before modifying a subsystem.
4. Reuse existing routes, components, auth, tenant scope, RBAC, audit, provider adapters, and data contracts before creating replacements.
5. Never fabricate production, provider, financial, clinical, deployment, connectivity, or verification state.
6. Never expose or commit credentials, tokens, private keys, or secret values.
7. Use real tests and the existing CI/build/typecheck commands; do not weaken tests to make a change appear green.
8. Continue independent work when one provider or authorization boundary is blocked.
9. Distinguish code/test/build/config/resource/authorization/provider/runtime/DNS/TLS/database/auth/storage/policy/verification failures.
10. Preserve ATLAS visual identity and the approved image-to-module implementation rule for UI work.
11. Do not leave fake buttons, `href="#"`, console-only actions, invented metrics, or false `Connected/Live/Ready` labels.
12. Report unresolved external dependencies precisely instead of simulating them.

The global file stays concise. Detailed procedures live in skills so the base prompt does not become an unmaintainable copy of all ATLAS documentation.

## Custom Agents
### `atlas-implementer`
Purpose: execute approved, scoped code changes.

Rules:
- inspect existing implementation first;
- follow applicable ATLAS design and plan;
- write or update tests with the change;
- avoid unrelated refactors;
- preserve tenant/RBAC/audit boundaries;
- never self-approve deployment truth.

### `atlas-reviewer`
Purpose: independently review diffs for correctness, duplication, architecture drift, security regressions, and unproven claims.

Default posture is review-first. It should not silently rewrite the change it is evaluating unless explicitly assigned an implementation task after review.

### `atlas-qa`
Purpose: validate behavior through the repository's real test, typecheck, build, route, state, and regression contracts.

It must separate:
- tests that actually executed and failed;
- workflows that failed before runner/job execution;
- checks that were not run;
- provider verification that cannot be performed with current authorization.

### `atlas-security`
Purpose: review secrets handling, auth, tenancy, RBAC, audit, data isolation, provider permissions, unsafe logging, and production exposure.

It must never print secret values as evidence.

### `atlas-deployment`
Purpose: coordinate deployment readiness under ATLAS Manager.

It may inspect and, when explicitly authorized through real tools/MCP integrations, operate GitHub/Vercel/Cloudflare/Supabase boundaries. It must never call a deployment complete until the production verification contract in `ATLAS_MANAGER_SPEC.md` is satisfied.

## Agent Skills
### `atlas-master-command`
Encodes the ATLAS image/product implementation sequence:
`IMAGE -> ANALYSIS -> CLASSIFICATION -> EXISTING ATLAS -> ARCHITECTURE -> MODULE -> ROUTE -> NAVIGATION -> COMPONENTS -> DATA -> PERMISSIONS -> FUNCTIONS -> TESTS -> COMMIT -> DEPLOY -> VERIFICATION`.

### `atlas-architecture`
Teaches agents to resolve canonical ownership, reuse shared services, avoid duplicate modules/routes/data sources, and preserve cross-module contracts.

### `atlas-testing`
Defines TDD/verification expectations, truthful CI interpretation, route checks, responsive/state testing, and the prohibition on weakening assertions merely to pass.

### `atlas-manager`
Encodes the Detect -> Classify -> Repair -> Verify -> Continue policy and provider-boundary failure taxonomy from `ATLAS_MANAGER_SPEC.md`.

### `atlas-production-truth`
Encodes the rule that repository state, CI state, deployment state, runtime health, provider connectivity, and public production verification are separate facts.

## MCP Integration Model
MCP is an extension mechanism, not a trust bypass.

Rules:
- repository or agent MCP configuration references only authorized servers;
- secret values remain in GitHub Copilot/agent secret storage or provider-approved secret stores;
- no secret is written into agent Markdown or skill files;
- MCP tools receive the least privilege necessary for the assigned role;
- write/deploy operations require the same ATLAS governance and human/provider approvals that would apply without Copilot;
- unavailable MCP providers are reported as unavailable, not simulated.

Initial intended MCP/provider domains, as integrations become authorized:
- GitHub
- Vercel
- Cloudflare
- Supabase
- ATLAS-owned orchestration/control services

## Task and Branch Flow
Normal engineering flow:

```text
approved objective
-> isolated branch/worktree
-> implementer
-> reviewer
-> QA/security as applicable
-> CI
-> PR
-> release gate
-> ATLAS Manager deployment gate
-> production verification
```

Custom agents must not push unrelated work directly into `main`. Existing release governance remains authoritative, including `release/atlas-a-z` while that program is active.

## Interaction with Existing ATLAS AI Work
This design complements, but does not duplicate, the provider-neutral ATLAS AI Collaboration Fabric work.

- GitHub Copilot customization governs how Copilot behaves inside this repository.
- ATLAS Orchestrator/Consensus governs ATLAS-owned cross-model task coordination when that implementation is merged and active.
- ATLAS Manager governs infrastructure state and deployment truth.
- Approved ATLAS specifications remain the architecture source of truth.

If shared `task-protocol`, `agent-registry`, `governance`, or `atlas-mcp` packages land through existing work, these repository agents should consume those contracts instead of creating competing versions.

## Error Handling
Agents must classify blockers before acting.

Examples:
- CI never received a runner: infrastructure/runner allocation problem, not automatically a software test failure.
- Vercel project missing: `resource_missing`.
- provider token missing: `authorization_missing`.
- build command fails after executing: `build_failure`.
- public route returns wrong build after successful deploy: `verification_failure`.

Every blocked result should identify evidence, attempted action, exact next executable action, and whether independent work remains possible.

## Security and Permissions
- No agent may bypass repository protections or provider approval gates.
- Agent files do not contain secrets.
- Deployment-capable MCP integrations use least privilege.
- Tenant, organization, RBAC, audit, and data-isolation rules in ATLAS Core remain mandatory.
- Reviewer/QA roles should be configured with narrower tool sets than implementer/deployment roles when the available GitHub surface supports that restriction.
- Production writes remain auditable.

## Validation
Before merging this control-plane configuration:

1. verify every custom agent file uses GitHub-supported YAML/frontmatter and filename conventions;
2. verify every skill directory contains a valid `SKILL.md` with required metadata;
3. confirm all referenced repository files actually exist;
4. ensure no agent/skill contains credentials or secret values;
5. verify the instructions do not contradict canonical repository governance or ATLAS Manager;
6. verify existing CI workflow files are unchanged unless a separate approved CI change is required;
7. inspect the resulting diff for duplication or accidental changes outside `.github` and documentation;
8. after merge to the default branch, confirm the custom agents/skills are discoverable in supported GitHub Copilot surfaces before calling the integration active.

## Rollout
### Phase 1 — repository behavior
Add global instructions, five specialist agents, and five foundational skills. No provider write access is required.

### Phase 2 — governed MCP
Attach authorized MCP providers to the minimum agents that need them. Keep unavailable providers explicitly unconfigured.

### Phase 3 — orchestration convergence
When shared ATLAS agent/task protocol packages are merged, wire Copilot agent output into those existing contracts rather than creating a second task ledger.

### Phase 4 — organization scale
If ATLAS moves to multiple canonical product repositories, evaluate organization-level custom agents/skills from an organization `.github` or `.github-private` repository.

## Success Criteria
This design is successful when:
- the default branch contains valid ATLAS Copilot custom instructions;
- GitHub recognizes the ATLAS custom agents;
- GitHub recognizes the ATLAS skills;
- agents consistently obey canonical repository, security, testing, and production-truth rules;
- specialist roles can work on isolated tasks without creating parallel architecture;
- MCP integrations, when added, use real authorization and least privilege;
- the resulting engineering flow still converges through the existing PR/CI/ATLAS Manager production gates.

## Non-Goals
- Replace ChatGPT as ATLAS's architecture/synthesis authority.
- Replace ATLAS Manager with Copilot.
- Rebuild GitHub's agent runtime.
- Grant agents universal production permissions.
- Store secrets in the repository.
- Create a second ATLAS task protocol if an approved one already exists or is being integrated.
- Call Copilot/MCP/provider integration `live` before GitHub/provider evidence verifies it.
