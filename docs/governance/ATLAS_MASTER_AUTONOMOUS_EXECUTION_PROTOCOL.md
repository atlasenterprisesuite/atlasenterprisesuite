# ATLAS Master Autonomous Execution Protocol

Status: canonical operating protocol
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Canonical branch: `main`
Production target: `https://www.atlasenterprisesuite.com`

## 1. End-to-end autonomy

For an ATLAS task, visual reference, screenshot, dashboard, app screen, menu, workflow, or integration request, execute continuously from understanding through verified delivery without pausing for intermediate approval unless a genuine boundary exists.

A genuine boundary is limited to:

- missing credentials or provider authorization that cannot be obtained from the existing authorized environment;
- an irreversible or destructive external action that materially changes production data or third-party state;
- a security, privacy, legal, billing, or provider-spend boundary requiring explicit human authorization;
- an external dependency that cannot truthfully be simulated;
- a technical blocker that cannot be resolved from the repository and available tools.

Do not stop merely to repeat status, ask for confirmation already granted, or re-diagnose a known issue without advancing it.

## 2. Visual reference is an implementation specification

Any ATLAS image, screenshot, dashboard, app, menu, or interface is a product specification and implementation instruction, not a background image or static mockup.

Canonical flow:

`IMAGE/REFERENCE -> ANALYSIS -> CLASSIFICATION -> EXISTING ATLAS -> ARCHITECTURE -> MODULE -> ROUTE -> NAVIGATION -> COMPONENTS -> DATA -> PERMISSIONS -> FUNCTIONS -> TESTS -> COMMIT -> DEPLOY -> VERIFY`

Before adding anything new, inspect current ATLAS modules, routes, components, tables, APIs, provider adapters, utilities, and governance so the implementation extends the existing ecosystem rather than duplicating it.

## 3. Functional product requirements

When a represented capability is technically available, implement the real interaction end-to-end:

- menu -> submenu -> section -> record -> final action;
- active, hover, selected, expanded, collapsed, loading, disabled, empty, error, and success states;
- search that searches;
- filters that filter;
- forms that validate and persist;
- tables that sort/filter/paginate when represented;
- charts backed by actual available data or truthful empty states;
- responsive desktop, tablet, and mobile behavior.

Do not use `href="#"`, console-only buttons, screenshot-as-interface substitutions, fabricated production metrics, or fake connected/live states.

## 4. Data, security, and backend

Reuse existing ATLAS APIs, endpoints, schemas, tables, hooks, services, and provider abstractions.

Preserve:

- tenant and organization isolation;
- authentication and session boundaries;
- RBAC and permission checks;
- auditability for sensitive actions;
- server-side secret handling;
- production/development separation;
- fail-closed provider behavior when readiness is unverified.

Never expose provider keys, tokens, passwords, certificates, recovery codes, or other secrets in source, UI, logs, issues, pull requests, prompts, or browser bundles.

## 5. Canonical provider and execution roles

ATLAS uses one governed architecture. External tools do not create parallel sources of truth.

### GitHub

Role: canonical source, change history, review surface, CI evidence, and release coordination.

Rules:

- `atlasenterprisesuite/atlasenterprisesuite` is canonical;
- `main` is the integration target;
- use focused branches for changes;
- preserve auditable commits and exact-head verification evidence;
- do not force-rewrite shared history;
- do not treat a failed pre-runner/provider check as proof of an application regression unless executable steps actually ran.

### Cloudflare

Role: primary ATLAS web/edge delivery target and production verification boundary.

Rules:

- reuse the canonical Worker/Wrangler configuration and existing deployment workflow;
- prefer the already-authorized deployment path proven by current repository evidence;
- classify authentication, authorization, configuration, and provider failures truthfully;
- after deploy, verify public routes and record exact deployment evidence;
- never claim production completion from source changes alone.

### Gemini

Role: governed intelligence provider and independent review/research capability when its runtime readiness is verified.

Rules:

- route Gemini through the existing `atlas-copilot` provider registry/intelligence gateway;
- keep credentials server-side;
- expose configured/verified/error states truthfully;
- no silent provider failover when explicit provider selection is required;
- Gemini has no independent authority to mutate production or bypass ATLAS approvals/RBAC.

### GitHub Copilot

Role: optional engineering assistance only.

Rules:

- Copilot is not required for ATLAS operation;
- it does not become a second orchestrator, provider registry, deployment authority, or source of truth;
- generated changes remain subject to the same repository, security, tenancy, testing, review, and deployment gates as any other change;
- no production mutation is trusted merely because Copilot proposed it.

## 6. Existing ATLAS intelligence architecture

The canonical intelligence direction is one `atlas-copilot` / intelligence bus with a provider registry and explicit provider readiness. Extend that architecture instead of creating another AI orchestration layer.

Provider capability must remain truthful: a provider may be implemented in source but still be externally gated until runtime credentials, probe results, and request-level verification prove readiness.

## 7. Testing and definition of done

Before declaring a code task complete, verify the applicable gates from the repository root:

```bash
npm ci
npm run typecheck
npm test
npm run build
```

Use focused tests during implementation and the repository's stronger aggregate gates where defined. Also verify affected routes, navigation, persistence, responsive behavior, authorization boundaries, and adjacent-regression risk.

A task is not production-complete until the affected code has been integrated through the canonical Git path, deployment has completed through the authorized production path when applicable, and production behavior has been verified against the exact deployed revision.

## 8. Completion reporting

At completion, report:

1. what was analyzed and reused;
2. what was implemented or changed;
3. tests and verification evidence actually obtained;
4. commit/PR/deploy evidence where applicable;
5. any external gate that remains, without representing it as complete.

Do not claim completion where evidence is absent.