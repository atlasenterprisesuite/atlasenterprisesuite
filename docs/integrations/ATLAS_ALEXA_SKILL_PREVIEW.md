# ATLAS Voice — Alexa Skill preview (777 REVIEW)

Status: **SIMULATION ONLY / P0 NO-GO**. This is a local, static protocol preview inside the existing `@atlas/voice` package. No Amazon account, Alexa device, Skill ID, endpoint, secret, or production integration has been configured.

## Ownership and reuse

- Canonical domain: `packages/voice/src`; export through `packages/voice/src/index.ts`.
- Existing assistant microphone and recognition code: `apps/web/src/assistant/voice.ts`. This Alexa preview does not access a microphone or capture audio.
- Existing telephony F4 work: PR #985. Do not join it to this branch; there is no PSTN/SIP/carrier operation here.
- Isolated implementation: `packages/voice/src/alexaSkillPreview.ts`.
- Test contract: `tests/unit/voice-alexa-skill-preview.test.ts`.

## Scope

The pure `previewAlexaSkill` function handles a **mock Alexa request envelope** with only these static, unprivileged responses:

- `LaunchRequest`: static welcome text.
- `AMAZON.HelpIntent`: static help text.
- `ATLAS.StatusIntent`: explicitly *unavailable*, with no account data.

Everything else is denied. An injected or guessed Alexa user ID, account access token, tenant ID, or arbitrary utterance is **never** accepted as ATLAS identity. There are no external network calls, durable records, real audio, real skill dispatches, or costs.

A successful preview means **only** that a deterministic local response was computed; it does not mean that a request originated from Amazon. Do not use this preview as an HTTP webhook, Lambda handler, or production security validator.

## Requirements before connecting real Alexa devices (P0)

1. Use an authenticated Amazon developer account to register an Alexa Custom Skill. Obtain its assigned Skill ID from Amazon, not from this repository.
2. Implement a **separate trusted ingress** following Amazon's current guidance. A custom HTTPS endpoint must verify certificate chain and `Signature-256` on the **raw** body and timestamp freshness (maximum 150 seconds), and validate the exact expected Skill ID before parsing/dispatch. A properly configured Alexa-triggered AWS Lambda may use Amazon's trigger-based skill-ID validation; verify all relevant requirements independently.
3. Provide OIDC/OAuth-based ATLAS account linking with validated tokens and server-side canonical Auth/Identity. Never treat Amazon `userId` as ATLAS authentication.
4. Resolve current tenant membership and action-specific RBAC/RLS through existing platform primitives, and audit denial/authorization with no raw transcripts or credentials.
5. Add a replay/idempotency store, quotas and signed-request negative tests for malformed certificates, payload changes, wrong Skill ID, expired requests, revoked linkage, cross-tenant access, and provider outages.
6. Review the Amazon interaction model, localized prompts, invocation name, user consent, data retention and certification policies. Include accessibility and real-device testing.
7. Execute Vitest, TypeScript, integration/E2E/security, independent review and CI on the exact Git SHA. Only then consider a GO decision. Merge/deploy remain blocked.

## Local testing (when full checkout and dependencies are available)

```sh
npx vitest run tests/unit/voice-alexa-skill-preview.test.ts
npm run typecheck
```

Do not report success from a missing runner, a documentation-only change, or a unit test that does not verify a real Amazon signature.

## Official references

- https://developer.amazon.com/en-US/docs/alexa/custom-skills/handle-requests-sent-by-alexa.html
- https://developer.amazon.com/en-US/docs/alexa/custom-skills/host-a-custom-skill-as-a-web-service.html
- https://developer.amazon.com/en-US/docs/alexa/custom-skills/security-testing-for-an-alexa-skill.html
- https://developer.amazon.com/en-US/docs/alexa/custom-skills/request-and-response-json-reference.html

ATLAS 777 REVIEW: no secrets, no skill publication, no merge, no deploy, no real devices.
