# ATLAS WhatsApp AI Council — Design

Date: 2026-09-06
Status: Design approved in chat; external WhatsApp Business authorization pending
Owner: ATLAS Orchestrator

## Objective

Connect the WhatsApp group/channel used for **Atlas Orquestador** to ATLAS so messages can trigger multi-agent analysis while **ChatGPT remains the permanent primary brain, synthesis authority, and final decision-maker for ATLAS development**.

Gemini, Copilot, and future providers are advisory agents only. They may research, critique, validate, or propose alternatives, but they cannot publish an ATLAS conclusion, mutate approved knowledge, or authorize development decisions independently.

## Product boundary

WhatsApp is a communication surface, not the ATLAS brain or source of truth.

The system must support additional channels later (ATLAS Voice, web, mobile, Slack, Teams, etc.) without changing the core orchestration model.

## Architecture

```text
WhatsApp Business / Atlas Orquestador
            |
            v
ATLAS WhatsApp Gateway
            |
            v
ATLAS Orchestrator
            |
            v
ChatGPT / OpenAI  <-- primary brain + final authority
      |        |
      v        v
   Gemini   Copilot   ...future advisory agents
      \        /
       \      /
        v    v
 advisory results + evidence
            |
            v
ChatGPT synthesis / conflict resolution
            |
            v
ATLAS decision + audit record
       |                 |
       v                 v
Knowledge Atlas      target ATLAS module
       |
       v
WhatsApp response
```

## Initial provider strategy

The WhatsApp transport must be implemented behind an adapter interface.

Initial supported transport candidate: **Peach for WhatsApp Business**, because the connected ChatGPT environment exposes it as a WhatsApp Business API integration capable of authenticated messaging, conversation access, media, templates, and workflow operations.

ATLAS must not hard-code business logic to Peach. The adapter must be replaceable by direct Meta WhatsApp Business Platform integration or another authorized provider.

## Proposed repository boundaries

```text
apps/
  atlas-orchestrator/
    src/
      api/
      webhooks/
        whatsapp/
      runtime/

packages/
  ai-core/
    council/
    providers/
      openai/
      gemini/
      copilot/

  integrations/
    whatsapp/
      adapter.ts
      peach.ts
      types.ts

  governance/
    permissions/
    approvals/
    audit/

  task-protocol/
    events/
    schemas/
```

These directories are introduced only if equivalent current components do not already exist when implementation begins.

## Message flow

1. WhatsApp provider receives a message from an authorized ATLAS conversation.
2. Provider sends an authenticated webhook/event to the ATLAS WhatsApp Gateway.
3. Gateway normalizes the event and rejects invalid signatures, unsupported event types, replayed events, or unauthorized sources.
4. ATLAS Orchestrator creates an immutable orchestration record.
5. ChatGPT interprets the request and decides whether auxiliary models are needed.
6. Advisory agents may run in parallel where useful.
7. Their outputs are returned to ChatGPT.
8. ChatGPT performs final synthesis, contradiction handling, and ATLAS recommendation generation.
9. Claims, evidence, disagreements, confidence, and provenance are recorded separately.
10. Only approved/validated knowledge may advance into Knowledge Atlas.
11. The final ChatGPT-authored response is sent back to WhatsApp.

## Authority rules

- ChatGPT is always the final synthesis authority for ATLAS development.
- Advisory model output is never an ATLAS decision by itself.
- Agreement among multiple models is not evidence of truth.
- External factual claims require provenance and validation appropriate to the domain.
- Sensitive module actions remain subject to ATLAS RBAC, approvals, and audit requirements.
- No provider may bypass ATLAS governance by issuing direct production mutations.

## Data model

Minimum logical records:

- `channel_messages`
- `orchestration_runs`
- `agent_messages`
- `claims`
- `sources`
- `contradictions`
- `atlas_decisions`
- `knowledge_candidates`
- `approved_knowledge`
- `audit_events`

Each record must be tenant/org scoped where applicable and preserve timestamps, correlation IDs, provider identity, model identity, and decision provenance.

## Security

- Verify provider webhook signatures or equivalent authenticated delivery mechanism.
- Store provider secrets only in approved secret management; never in Git.
- Enforce idempotency/replay protection on inbound events.
- Require allowlisted WhatsApp identities/conversations before ATLAS execution.
- Apply rate limits and bounded advisory-agent rounds.
- Log sensitive actions without storing unnecessary message content or credentials.
- Never label the integration `live`, `connected`, or `verified` until an authenticated end-to-end message has been received, processed, and successfully answered through the real WhatsApp channel.

## Failure behavior

- If Gemini/Copilot/advisory providers fail, ChatGPT may continue when it has enough information to answer safely and accurately.
- If ChatGPT/OpenAI primary-brain execution fails, ATLAS must not allow another model to silently take final authority. The run fails or is queued for retry according to orchestration policy.
- If outbound WhatsApp delivery fails, preserve the ATLAS decision and delivery status separately.
- Duplicate inbound webhook events must not create duplicate ATLAS actions.

## Testing gates

Before production merge:

1. Unit tests for normalization, authorization, idempotency, and routing.
2. Contract tests for the WhatsApp provider adapter.
3. Tests proving advisory models cannot finalize an ATLAS decision.
4. Tests proving ChatGPT final synthesis is required before an ATLAS decision is emitted.
5. Webhook signature/authentication tests.
6. Replay and duplicate-delivery tests.
7. Failure-path tests for each provider.
8. End-to-end test from real WhatsApp inbound message to real WhatsApp outbound response.
9. Audit-log verification.
10. Production endpoint verification without 404/500.

## Production truth states

The integration progresses through explicit states:

`designed -> provider_authorization_pending -> configured -> integration_tested -> end_to_end_verified -> production_enabled`

No state may be skipped in reporting.

## Current dependency

The current ChatGPT environment has surfaced **Peach for WhatsApp Business** as the most relevant available WhatsApp Business connector, but the user's WhatsApp Business account still requires explicit authorization through that connector before ATLAS can receive or send real WhatsApp messages.

Until that authorization exists, the repository work can proceed, but the integration must remain `provider_authorization_pending` and must not be represented as connected or live.

## Acceptance criteria

The feature is complete only when:

- an authorized message from Atlas Orquestador reaches ATLAS;
- ATLAS routes it through ChatGPT as primary brain;
- optional Gemini/Copilot advisory responses can be incorporated;
- ChatGPT generates the final ATLAS conclusion;
- provenance/audit records are created;
- the final response returns to the same WhatsApp conversation;
- duplicate messages do not duplicate actions;
- unauthorized conversations cannot trigger ATLAS;
- provider failure does not transfer final authority away from ChatGPT;
- an end-to-end production verification is recorded.
