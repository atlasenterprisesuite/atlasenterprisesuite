# ATLAS Identity — Persona Sandbox proofing | ATLAS 777 REVIEW

**Status:** Source implementation in Draft PR #1016. **Not deployed, not connected, not production-ready. P0 NO-GO.**

This is **identity proofing**, not sign-in, MFA or automatic entitlement. It never imports another organization's Persona inquiry (including a ChatGPT verification link) or copies identity documents into ATLAS. Reuse canonical Supabase Auth, `organization_members`, `identity_permissions`, `identity_role_permissions` and `organization_role_permissions`.

## Sources and files

- `packages/compliance/persona.ts`: raw-body `Persona-Signature` HMAC-SHA256 verifier (5-minute delivery-time tolerance, rotation), signed-event decision mapper.
- `supabase/migrations/20261106091500_atlas_persona_sandbox_proofing.sql`: provider link, explicit consent, tenant scope, idempotent event audit, atomic server-only RPCs.
- `supabase/functions/atlas-persona-start/index.ts`: JWT + organization + consent + canonical permission, reservation, sandbox API create, response with one-time URL.
- `supabase/functions/atlas-persona-webhook/index.ts`: **no ATLAS JWT**, validates provider HMAC *before* admin DB access; rejects unknown inquiry; atomically records event.
- `supabase/config.toml`: `start: verify_jwt=true`, `webhook: verify_jwt=false` (HMAC required).
- `tests/unit/persona-verification.test.ts` and `tests/integration/persona-sandbox-backend-contract.test.ts`; `.github/workflows/persona-identity-adapter-ci.yml` provides CI checks.

## Intended sequence

1. User signs in to ATLAS; active org and `identity.proofing.create` verified; user explicitly consents. No browser-provided subject, template, role or provider ID accepted. Only owner/admin receive the default grant; organization role override can explicitly deny it.
2. RPC reserves one active self-proofing request per (organization, actor, purpose, environment) using an advisory transaction lock and partial unique index. This creates a server-generated opaque `reference_id` and stores the consent version/time.
3. With `PERSONA_MODE=sandbox` and ATLAS-owned Sandbox API key/template, create an inquiry using Persona's 2026-09-29 API and `Idempotency-Key` tied to the local reservation. Check response inquiry ID, reference and template. Store the link via scoped atomic RPC and return only an allowlisted HTTPS one-time hosted URL; never log or persist the URL.
4. Persona calls public webhook. Its unmodified body must pass the HMAC check with `PERSONA_WEBHOOK_SECRET`, including timestamp tolerance. The inquiry must already match an ATLAS-owned database record. Event IDs are unique, event creation order is monotonic, and event status + event evidence + audit commit within one DB transaction.
5. `inquiry.completed` is **pending**, never an approval. `inquiry.approved` may set a *proofing-only* status to approved. No Supabase session, role, financial action, Ride eligibility, immigration filing or MFA state may be upgraded from this result alone. Tenant permission must still be re-evaluated for every protected operation.

## Secrets and deployment boundary

Do not commit credentials. Set via authorized Supabase secret management **only after** ATLAS Persona Sandbox account, vendor/compliance review, and budget permission:

- `PERSONA_MODE=sandbox`
- `PERSONA_API_KEY`: ATLAS-owned `persona_sandbox_...` secret
- `PERSONA_TEMPLATE_ID`: ATLAS-owned template starting `itmpl_`
- `PERSONA_WEBHOOK_SECRET`: from ATLAS Persona webhook configuration
- Existing Supabase runtime URL, publishable key, server-only service-role key.

Endpoints are deliberately inert without these values. The migration exists **only in source** and has **not** been applied to production. It enables RLS on all new tables, revokes direct `anon`/`authenticated` access and restricts RPC execution to `service_role`; trusted server RPCs also check organization and individual identity. No raw webhook bodies, biometrics, birthdates, documents or images are stored in these tables.

## Evidence and remaining P0 gates

Source unit tests and static backend-contract tests are wired to GitHub Actions. **A successful source contract test is not a PostgreSQL migration or RLS isolation test.** Before production: run the migration in isolated PostgreSQL 17 against genuine Auth/organization dependencies; verify anonymous/authenticated denial, cross-tenant/cross-subject attempts, revocation, webhook duplicates, concurrent reservations, rollback on audit failure and out-of-order events with unprivileged roles. Then run a real ATLAS-owned Persona Sandbox end-to-end flow, verify data retention/deletion/consent and legal review, obtain independent security sign-off, and confirm CI at the exact PR SHA. Only then consider merge and separately authorized deploy. No automated production provider fallback or external spending.

## Official provider reference

- https://docs.withpersona.com/2026-09-29/api-reference/inquiries/create-an-inquiry
- https://docs.withpersona.com/webhooks-best-practices
- https://docs.withpersona.com/events
