# ATLAS AI Council Implementation Plan

Date: 2026-09-06
Status: Approved plan
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Branch: `release/atlas-a-z`

## Objective

Implement the governed multi-model collaboration layer defined in the ATLAS AI Council design.

## Slice 1 — Core Domain

Build the provider-independent foundation first.

Deliverables:

- task model
- command parser
- state machine
- provider interface
- response envelope
- consensus contract
- loop guard
- evidence model

Dependencies:

- reuse `packages/core` RBAC, tenancy, audit, and result patterns
- reuse `packages/automations` trigger/action concepts

## Slice 2 — Provider Adapters

Create isolated adapters:

- OpenAI adapter
- Gemini adapter
- GitHub/Copilot adapter

Requirements:

- no provider-specific objects leak into core
- explicit health state
- configured/degraded/unavailable/verified states only when evidence exists

## Slice 3 — GitHub Discussion Integration

Implement:

- webhook ingestion
- command detection
- authenticated responses
- task correlation
- Discussion to Issue linkage

## Slice 4 — Consensus Workflow

Implement:

- independent provider execution
- evidence collection
- deterministic policy evaluation
- consensus states
- audit trail

Allowed outcomes:

- approved
- approved_with_conditions
- needs_human_review
- blocked
- insufficient_evidence

## Slice 5 — Execution Handoff

Connect approved tasks to:

- GitHub Issues
- PR workflows
- Copilot/Codex-compatible execution paths

No direct production mutation from Discussion commands.

## Verification Gates

Before production readiness:

- typecheck passes
- unit tests pass
- integration tests pass
- webhook validation tested
- RBAC tested
- loop prevention tested
- secrets excluded from source/logs
- Discussion → Issue → PR flow verified
- audit evidence generated

## First Implementation Task

Create the minimal `ai-council-core` package with tests before external integrations.
