# ATLAS 777 REVIEW — OpenCode Team compatibility pilot

Source evaluated: https://github.com/josevdr95new/opencode-team
Reference source HEAD: d7c1a01f301b9080d9e7b74f2883bcd7173f880d
ATLAS baseline: 6f981f7b1eb267b66bd70a2b9582ce7fb114f15d

## Decision: NO-GO for runtime integration

This is an isolated compatibility experiment, not an installation or runtime certification.
ATLAS already owns an agent registry, governed orchestration, audit gates, CI, and a
Cloudflare MCP configuration in `.opencode.jsonc`. Do not replace those assets or
make the external `orchestrator` the ATLAS default agent.

## Reuse map

- External orchestrator -> existing ATLAS orchestration and governance.
- External designer/frontend/backend/developer -> existing ATLAS implementation roles.
- External debugger -> ATLAS testing and systematic incident workflow.
- External security-auditor -> ATLAS security review; read-only and fail closed.
- External SDD and code-review skills -> candidate process improvements only.

## Acceptance gates

1. Run `node --test tests/node/opencode-team-compatibility.test.mjs`.
2. Existing MCP providers, tenant boundaries, and canonical repository must remain intact.
3. Review third-party skills and their versions/licenses before adoption.
4. Verify actual OpenCode CLI runtime and subagent delegation in a disposable workspace.
5. Execute a negative permission test proving agents cannot write/deploy without authorization.
6. Record reproducible logs, CI run URL, tested commit SHA, and report digest.
7. Compare outcomes with ATLAS existing workflow before proposing any production change.

**Runtime: unverified. No production deploy.** Static checks cannot prove agent
execution, external skill installation, or end-to-end behavior. Until those
checks pass with evidence, do not merge an external agent runtime into ATLAS.
