# ATLAS Copilot Agent Control Plane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a validated repository-native GitHub Copilot execution layer to the canonical ATLAS repository without duplicating ATLAS Manager, ATLAS Orchestrator, or existing CI.

**Architecture:** Store global Copilot behavior in `.github/copilot-instructions.md`, specialized roles in `.github/agents/*.agent.md`, and reusable rules in `.github/skills/*/SKILL.md`. Add a Vitest unit contract that verifies required files, frontmatter, canonical-governance references, and production-truth guardrails; the existing `ATLAS Consensus CI` already runs `npm run test:unit` on pull requests to `main`, so no new workflow is required.

**Tech Stack:** GitHub Copilot repository customization, Markdown/YAML frontmatter, TypeScript 5.7, Vitest 3.2, Node.js filesystem APIs, existing GitHub Actions consensus workflow.

**Spec:** `docs/superpowers/specs/2026-09-06-atlas-copilot-agent-control-plane-design.md`

## Global Constraints

- Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`.
- `main` remains production-stable; implementation occurs on an isolated branch and converges through PR review/CI.
- Do not create a generic `.mcp/` directory; MCP configuration belongs in GitHub repository settings and/or agent `mcp-servers` configuration when authorized.
- Do not store secrets, tokens, private keys, or provider credentials in agent/skill/instruction files.
- Do not duplicate ATLAS Manager, ATLAS Orchestrator, task protocol, agent registry, governance, or provider integrations.
- Repository/CI/deployment/runtime/provider/public-production states remain separate facts.
- Existing `.github/workflows/atlas-consensus-ci.yml` remains the CI gate; no duplicate Copilot workflow is added.

---

### Task 1: Add the Copilot configuration contract test

**Files:**
- Create: `tests/unit/copilotRepositoryConfig.test.ts`

**Interfaces:**
- Consumes: repository filesystem at `process.cwd()`.
- Produces: a Vitest contract that fails when required Copilot instructions, agents, or skills are missing or lose mandatory governance markers.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/copilotRepositoryConfig.test.ts` with:

```ts
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

const agents = [
  "atlas-implementer",
  "atlas-reviewer",
  "atlas-qa",
  "atlas-security",
  "atlas-deployment",
];

const skills = [
  "atlas-master-command",
  "atlas-architecture",
  "atlas-testing",
  "atlas-manager",
  "atlas-production-truth",
];

describe("ATLAS GitHub Copilot repository configuration", () => {
  it("defines repository-wide ATLAS governance instructions", () => {
    const path = ".github/copilot-instructions.md";
    expect(existsSync(join(root, path))).toBe(true);
    const content = read(path);
    expect(content).toContain("atlasenterprisesuite/atlasenterprisesuite");
    expect(content).toContain("ATLAS_MANAGER_SPEC.md");
    expect(content).toContain("ATLAS_CANONICAL_REPOSITORY.md");
    expect(content).toContain("Never fabricate");
    expect(content).toContain("Never expose or commit credentials");
  });

  it.each(agents)("defines valid %s agent profile", (agent) => {
    const path = `.github/agents/${agent}.agent.md`;
    expect(existsSync(join(root, path))).toBe(true);
    const content = read(path);
    expect(content.startsWith("---\n")).toBe(true);
    expect(content).toMatch(/\ndescription:\s*.+/);
    expect(content).toContain("ATLAS");
    expect(content).toContain("production");
  });

  it.each(skills)("defines valid %s skill", (skill) => {
    const path = `.github/skills/${skill}/SKILL.md`;
    expect(existsSync(join(root, path))).toBe(true);
    const content = read(path);
    expect(content.startsWith("---\n")).toBe(true);
    expect(content).toContain(`name: ${skill}`);
    expect(content).toMatch(/\ndescription:\s*.+/);
  });

  it("does not introduce repository-stored provider secrets", () => {
    const files = [
      ".github/copilot-instructions.md",
      ...agents.map((agent) => `.github/agents/${agent}.agent.md`),
      ...skills.map((skill) => `.github/skills/${skill}/SKILL.md`),
    ];
    const forbidden = [
      /BEGIN (RSA|OPENSSH|EC) PRIVATE KEY/,
      /gh[pousr]_[A-Za-z0-9_]{20,}/,
      /sk-[A-Za-z0-9_-]{20,}/,
    ];
    for (const file of files) {
      const content = read(file);
      for (const pattern of forbidden) expect(content).not.toMatch(pattern);
    }
  });
});
```

- [ ] **Step 2: Run the unit test and verify RED**

Run:

```bash
npx vitest run tests/unit/copilotRepositoryConfig.test.ts
```

Expected: FAIL because `.github/copilot-instructions.md`, agent profiles, and skill files do not yet exist.

- [ ] **Step 3: Commit the RED contract**

```bash
git add tests/unit/copilotRepositoryConfig.test.ts
git commit -m "test: define ATLAS Copilot repository contract"
```

---

### Task 2: Add repository-wide Copilot instructions and foundational skills

**Files:**
- Create: `.github/copilot-instructions.md`
- Create: `.github/skills/atlas-master-command/SKILL.md`
- Create: `.github/skills/atlas-architecture/SKILL.md`
- Create: `.github/skills/atlas-testing/SKILL.md`
- Create: `.github/skills/atlas-manager/SKILL.md`
- Create: `.github/skills/atlas-production-truth/SKILL.md`

**Interfaces:**
- Consumes: `docs/governance/ATLAS_CANONICAL_REPOSITORY.md`, `docs/architecture/ATLAS_MANAGER_SPEC.md`, approved ATLAS specs/plans.
- Produces: repository-global behavioral contract and reusable skill modules discoverable by supported GitHub Copilot surfaces.

- [ ] **Step 1: Create `.github/copilot-instructions.md`**

Use this exact policy core:

```md
# ATLAS Copilot Repository Instructions

This repository is the operational source of truth for ATLAS Enterprise Suite: `atlasenterprisesuite/atlasenterprisesuite`.

Before changing a subsystem, read the applicable approved design/spec/plan plus `docs/governance/ATLAS_CANONICAL_REPOSITORY.md` and `docs/architecture/ATLAS_MANAGER_SPEC.md` when infrastructure or deployment is involved.

Use isolated feature branches and pull requests. Treat `main` as production-stable. Reuse existing routes, shared components, tenant scope, RBAC, audit, provider adapters, data contracts, and stronger existing implementations before creating anything parallel.

Never fabricate production, provider, financial, clinical, deployment, connectivity, readiness, or verification state. Repository state, CI state, deployment state, runtime health, provider connectivity, and public production verification are separate facts.

Never expose or commit credentials, tokens, private keys, or secret values. Report missing authorization precisely and continue independent work when possible.

Use real tests, typecheck, build, and existing CI gates. Do not weaken assertions or remove verification merely to make a change pass.

For UI/reference-image work, follow the approved ATLAS sequence: IMAGE -> ANALYSIS -> CLASSIFICATION -> EXISTING ATLAS -> ARCHITECTURE -> MODULE -> ROUTE -> NAVIGATION -> COMPONENTS -> DATA -> PERMISSIONS -> FUNCTIONS -> TESTS -> COMMIT -> DEPLOY -> VERIFICATION.

Do not leave fake buttons, `href="#"`, console-only actions, invented metrics, or false `Live`, `Connected`, `Ready`, or `100% functional` labels.
```

- [ ] **Step 2: Create `atlas-master-command` skill**

```md
---
name: atlas-master-command
description: Apply the approved ATLAS image-to-module-to-production implementation sequence to UI and product-reference work.
---

When an image, screenshot, dashboard, app, menu, interface, or design reference is supplied for ATLAS, treat it as a product specification and implementation instruction, not as a background image or mockup substitute.

Follow this order:
IMAGE -> ANALYSIS -> CLASSIFICATION -> EXISTING ATLAS -> ARCHITECTURE -> MODULE -> ROUTE -> NAVIGATION -> COMPONENTS -> DATA -> PERMISSIONS -> FUNCTIONS -> TESTS -> COMMIT -> DEPLOY -> VERIFICATION.

Reuse stronger existing ATLAS behavior. Do not invent metrics, live connections, provider state, or unsupported functionality. Every visible action must either work through a real implementation or show a truthful unavailable/configuration state.
```

- [ ] **Step 3: Create `atlas-architecture` skill**

```md
---
name: atlas-architecture
description: Preserve canonical ATLAS ownership, shared architecture, and anti-duplication rules while implementing changes.
---

Resolve the owning ATLAS module before creating routes, packages, services, schemas, or integrations. Search the current repository first and reuse shared shell, auth, tenancy, RBAC, audit, navigation, provider adapters, and data contracts.

Do not create a parallel source of truth for an existing subsystem. If an approved implementation or active integration branch already owns the capability, extend or consume that work rather than duplicating it.

Keep module boundaries explicit and make cross-module dependencies flow through defined interfaces.
```

- [ ] **Step 4: Create `atlas-testing` skill**

```md
---
name: atlas-testing
description: Enforce truthful ATLAS test, CI, build, route, state, and regression verification.
---

Prefer a failing test that proves the intended behavior before implementation when code behavior changes. Run the smallest relevant test first, then the broader unit/integration/typecheck/build gates required by the affected surface.

Distinguish tests that executed and failed from workflows that never received a runner, checks that were skipped, and provider verification that could not run. Never describe an unexecuted check as passed or failed software.

Do not delete or weaken assertions merely to obtain green CI. Validate empty, loading, disabled, error, success, authorization, and responsive states when applicable.
```

- [ ] **Step 5: Create `atlas-manager` skill**

```md
---
name: atlas-manager
description: Apply the ATLAS Manager Detect-Classify-Repair-Verify-Continue infrastructure policy.
---

For infrastructure and deployment work, read `docs/architecture/ATLAS_MANAGER_SPEC.md`.

Operate as: Detect -> Classify -> Repair when authorized -> Verify the exact boundary -> Continue independent work.

Classify failures at the correct boundary, including code, test, build, configuration, resource, authorization, provider, DNS, TLS, runtime, database, auth, storage, policy, verification, and human-approval failures.

Never expose secrets and never call a provider or production state verified without evidence.
```

- [ ] **Step 6: Create `atlas-production-truth` skill**

```md
---
name: atlas-production-truth
description: Prevent false ATLAS readiness claims by keeping repository, CI, deployment, runtime, provider, and public-production evidence separate.
---

Do not infer production truth from source control alone. A merged commit does not prove deployment; a provider-accepted deployment does not prove runtime health; runtime health does not prove DNS or public-edge correctness.

Use evidence-specific language: committed, CI-passed, deployed, provider-ready, runtime-healthy, domain-routed, or publicly verified. Only use `live`, `connected`, `ready`, `production ready`, or `100% functional` when the corresponding evidence exists.
```

- [ ] **Step 7: Run the contract test**

```bash
npx vitest run tests/unit/copilotRepositoryConfig.test.ts
```

Expected: still FAIL because agent profiles are not yet present; instruction and skill assertions pass.

- [ ] **Step 8: Commit instructions and skills**

```bash
git add .github/copilot-instructions.md .github/skills
git commit -m "feat: add ATLAS Copilot instructions and skills"
```

---

### Task 3: Add five specialist GitHub Copilot agents

**Files:**
- Create: `.github/agents/atlas-implementer.agent.md`
- Create: `.github/agents/atlas-reviewer.agent.md`
- Create: `.github/agents/atlas-qa.agent.md`
- Create: `.github/agents/atlas-security.agent.md`
- Create: `.github/agents/atlas-deployment.agent.md`

**Interfaces:**
- Consumes: repository instructions and skills from Task 2 plus existing ATLAS specs/governance.
- Produces: five GitHub-supported custom agent profiles with scoped role behavior.

- [ ] **Step 1: Create implementer profile**

```md
---
name: ATLAS Implementer
description: Implements approved ATLAS changes on isolated branches while preserving architecture, security, tests, and production truth.
tools:
  - read
  - search
  - edit
  - terminal
---

You are the ATLAS implementation specialist. Read the applicable approved spec/plan and existing implementation before editing. Reuse stronger existing components and contracts. Write or update tests with behavior changes, avoid unrelated refactors, preserve tenant/RBAC/audit boundaries, and never claim production verification from implementation alone.
```

- [ ] **Step 2: Create reviewer profile**

```md
---
name: ATLAS Reviewer
description: Reviews ATLAS changes for correctness, duplication, architecture drift, regressions, and unsupported production claims.
tools:
  - read
  - search
  - terminal
---

You are an independent ATLAS reviewer. Inspect the diff and applicable specs. Surface concrete defects, architecture duplication, broken contracts, missing tests, unsafe assumptions, and unproven live/production claims. Prefer evidence over stylistic noise. Do not silently rewrite the change unless explicitly reassigned to implementation.
```

- [ ] **Step 3: Create QA profile**

```md
---
name: ATLAS QA
description: Executes ATLAS tests, typechecks, builds, route/state checks, and distinguishes software failures from infrastructure failures.
tools:
  - read
  - search
  - terminal
---

You are the ATLAS QA specialist. Run the smallest relevant verification first and then required broader gates. Distinguish executed failures from runner-allocation failures, skipped checks, and unavailable provider verification. Validate success, error, loading, disabled, empty, authorization, and responsive states when applicable. Never report an unexecuted check as passed.
```

- [ ] **Step 4: Create security profile**

```md
---
name: ATLAS Security
description: Reviews ATLAS auth, tenancy, RBAC, audit, secrets handling, provider permissions, data isolation, and production exposure.
tools:
  - read
  - search
  - terminal
---

You are the ATLAS security specialist. Review least privilege, tenant and organization isolation, RBAC, audit coverage, sensitive logging, provider authorization, and secret handling. Never print secret values as evidence. Flag any path that bypasses existing ATLAS Core governance or provider approval gates.
```

- [ ] **Step 5: Create deployment profile**

```md
---
name: ATLAS Deployment
description: Coordinates deployment readiness under ATLAS Manager without fabricating provider or production state.
tools:
  - read
  - search
  - terminal
---

You are the ATLAS deployment specialist. Read `docs/architecture/ATLAS_MANAGER_SPEC.md`. Use Detect -> Classify -> Repair when authorized -> Verify -> Continue. Treat repository, CI, deployment, runtime, DNS/TLS, backend dependency, and public-production verification as separate gates. Do not add MCP servers or provider credentials to this file until an authorized repository or agent configuration exists.
```

- [ ] **Step 6: Run the Copilot contract test**

```bash
npx vitest run tests/unit/copilotRepositoryConfig.test.ts
```

Expected: PASS.

- [ ] **Step 7: Run all unit tests**

```bash
npm run test:unit
```

Expected: PASS if the runner executes normally. If execution cannot start because of an external runner/infrastructure incident, report that state separately and do not label the code failed.

- [ ] **Step 8: Commit agent profiles**

```bash
git add .github/agents
git commit -m "feat: add ATLAS Copilot specialist agents"
```

---

### Task 4: Validate repository integration and open the PR

**Files:**
- Verify: `.github/copilot-instructions.md`
- Verify: `.github/agents/*.agent.md`
- Verify: `.github/skills/*/SKILL.md`
- Verify: `tests/unit/copilotRepositoryConfig.test.ts`
- Verify unchanged: `.github/workflows/atlas-consensus-ci.yml`

**Interfaces:**
- Consumes: all files from Tasks 1-3 and the existing consensus CI workflow.
- Produces: an auditable PR ready for GitHub/Copilot discovery after merge to the default branch.

- [ ] **Step 1: Run targeted and full repository gates**

```bash
npx vitest run tests/unit/copilotRepositoryConfig.test.ts
npm run test:unit
npm run typecheck
npm run build
```

Expected: all executed software checks PASS. Any pre-run GitHub runner allocation failure is recorded as infrastructure evidence, not rewritten as a test failure.

- [ ] **Step 2: Inspect the diff**

```bash
git diff main...HEAD -- .github tests/unit/copilotRepositoryConfig.test.ts docs/superpowers/specs/2026-09-06-atlas-copilot-agent-control-plane-design.md docs/superpowers/plans/2026-09-06-atlas-copilot-agent-control-plane.md
```

Expected: only the approved Copilot configuration, contract test, design, and plan are present; existing workflow behavior is unchanged.

- [ ] **Step 3: Confirm no secret-like material**

```bash
git grep -nE 'BEGIN (RSA|OPENSSH|EC) PRIVATE KEY|gh[pousr]_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}' -- .github || true
```

Expected: no secret values found.

- [ ] **Step 4: Open a pull request to `main`**

PR title:

```text
feat: add ATLAS Copilot agent control plane
```

PR body must state:
- repository-native instructions, five agents, five skills, and validation test added;
- no MCP server or provider credential is configured yet;
- existing ATLAS Consensus CI remains the verification gate;
- merge to default branch is required before claiming GitHub Copilot discovery is active;
- post-merge discovery in supported Copilot surfaces remains a separate verification step.

- [ ] **Step 5: Verify PR/CI state**

Inspect the PR head SHA and GitHub Actions results. If workflows execute, use their actual results. If they fail before runner assignment, preserve the infrastructure classification and continue all independent review work.
