# ATLAS Agent Collaboration Protocol

This document defines how concurrent AI-assisted work is coordinated during the ATLAS A-Z closure.

## Canonical integration axis

- `release/atlas-a-z` is the current integration axis.
- `main` remains protected conceptually and must not receive unfinished domain work.
- A feature branch or pull request is evidence, not authority. No branch wins solely because of its authoring agent or timestamp.

## Agent workflow

Copilot, Gemini, ChatGPT, and other agents should work on isolated branches or pull requests. Their output is evaluated by the same criteria:

1. preserve tenant and organization isolation;
2. preserve RBAC and audit contracts;
3. no fake provider, live, financial, clinical, or deployment state;
4. prefer additive domain changes over replacing the shared shell/Core;
5. require typecheck, tests, build, and domain-specific safety gates;
6. do not weaken existing CI to make a branch pass;
7. when implementations overlap, preserve the implementation with stronger evidence and selectively port unique improvements from the others.

## Integration rule

The A-Z release branch absorbs only the verified parts of concurrent work. Diverged feature branches are not merged wholesale when they would reintroduce older Core, routing, identity, tenancy, or demo-state assumptions.

## Current arbitration ownership

The master release PR (`#13`) is the coordination surface. Concurrent agents may continue producing work, but integration order and surviving implementations are decided against the current `release/atlas-a-z` head and its full verification matrix.
