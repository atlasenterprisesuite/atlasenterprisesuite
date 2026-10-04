# ATLAS Background Brain

Date: 2026-10-01  
Status: implementation contract  
Canonical owner: ATLAS Assistant / ATLAS Intelligence

## Purpose

ATLAS Background Brain separates conversational latency from long-running generation and reasoning work.

Ordinary prompts remain interactive. Work that is explicitly requested in background, uses the Deep profile, is materially large, or matches a bounded long-work classifier may be detached from the HTTP response path.

## Canonical flow

```text
User
  -> ATLAS Assistant
  -> authenticated tenant/RBAC context
  -> provider readiness + cost policy
  -> execution classifier
       -> Interactive lane: Intelligence Gateway -> response
       -> Background lane:
            -> zero-cost/self-hosted provider: Supabase EdgeRuntime.waitUntil
            -> OpenAI Responses provider: native background=true
  -> atlas_ai_requests lifecycle
  -> same ATLAS conversation
  -> persisted assistant result
```

Background generation is not a second conversation system and does not replace Universal Execution Engine.

- Generation/reasoning that only needs an AI result belongs to Background Brain.
- Multi-step operational work, external mutations, approvals, browser execution, or durable business workflows remain owned by ATLAS Work + Universal Execution Engine.
- Tool mutations remain governed by the existing Tool Gateway and approval boundaries.

## Fast path

Provider readiness probes run concurrently. ATLAS Copilot keeps a short-lived in-worker readiness cache so ordinary chat does not intentionally serialize independent provider health checks.

The UI must never render a blank successful assistant response. Empty provider output is treated as an error.

## Background providers

### ATLAS Local / zero-cost

When the Supabase Edge runtime exposes `EdgeRuntime.waitUntil`, a verified local provider can run after the HTTP response is returned. The local detached path is bounded to one inference attempt so it stays inside the edge worker's wall-clock envelope.

The job lifecycle is persisted in `atlas_ai_requests`. Completion writes the final assistant message into the original conversation.

### OpenAI

The OpenAI Responses adapter may create a response with `background: true` and `store: false`. ATLAS stores only the provider response identifier needed for governed polling. Provider status is reconciled into the original ATLAS request and conversation.

ATLAS does not bypass the existing cost policy to use a paid provider in background. If paid execution is not pre-authorized, Auto mode falls back to the ordinary synchronous zero-cost path instead of silently incurring cost.

## Recovery

While the assistant page is open, the client polls the authenticated ATLAS background endpoint.

If the page is closed, provider/edge work can continue independently. Reopening the same conversation reconciles outstanding background requests before rendering conversation history.

Repeated polling is idempotent at the conversation layer: ATLAS checks for an existing assistant message with the same trace identifier before appending a final result.

## User-facing states

- Queued
- Running
- Completed
- Failed / blocked

A background placeholder is evidence of an active request, not evidence of completion.

## Current runtime limits

Supabase Edge background work remains subject to the host wall-clock limit. Long operational workflows that can exceed the edge limit must use ATLAS Work / Universal Execution Engine or a provider-native durable background primitive.

OpenAI background response retention follows the provider's current background-mode data controls. ATLAS keeps `store:false` unless a separately governed retention policy explicitly changes that behavior.

## Next hardening

1. Add signed provider webhook completion so native provider background tasks can finalize without client polling.
2. Add cancellation from the conversation UI.
3. Add a Background Activity Center with tenant-scoped active/completed jobs.
4. Add SSE streaming for the interactive lane and resumable streaming for compatible provider background responses.
5. Add stale detached-job reconciliation and retry through Universal Execution Engine when work exceeds edge limits.
