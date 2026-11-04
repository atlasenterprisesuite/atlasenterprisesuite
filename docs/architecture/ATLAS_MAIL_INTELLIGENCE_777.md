# ATLAS Mail Intelligence 777 — Architecture and P0 gates

Status: DESIGN ONLY — FAIL CLOSED. No production enablement.

## Reuse inventory
- supabase/functions/atlas-mail-provisioning/index.ts — Cloudflare routing alias provisioning.
- apps/web/src/lib/mailProvisioningApi.ts and modules/connect/AtlasMailProvisioningPage.tsx — frontend API/UI.
- supabase/functions/_shared/google-oauth.ts — signed Google OAuth state, Gmail scopes.
- apps/web/src/work/WorkOSPage.tsx — work orchestration.
- apps/web/src/modules/advisory/enterpriseAutomationModel.ts — automation model.
- worker/index.ts — existing worker entrypoint; persistence and isolation not yet verified.

## Proposed boundaries
Provider adapters (Gmail API; iCloud Mail through supported authorized access; standards-based IMAP where applicable) -> normalized message metadata -> tenant-scoped encrypted storage and search -> consent-gated classifiers -> human-approved external actions. Cloudflare email routing is forwarding, not a full mailbox.

## Mandatory P0 tests (red before implementation)
1. Deny cross-tenant message, attachment, token and alias access using authenticated organization context and RLS.
2. Reject untrusted OAuth state, expired state, replayed nonce, mismatched user/tenant, revoked grants.
3. Fail closed when immutable audit receipt cannot be committed; reconcile provider-side partial effects.
4. Concurrency: two simultaneous alias requests must yield at most one provider rule, with durable idempotency key and receipt.
5. No message sends, deletions, forwards or calendar writes without explicit scoped authorization and durable external-effect idempotency.
6. Do not expose provider tokens, message bodies, attachment contents or personal identifiers in logs.
7. Quarantine malicious attachments and prompt-injection instructions; email content is untrusted data.
8. Verify queue recovery, bounded retries, dead-letter handling, lease ownership, and exact-SHA E2E before deployment.

## P1
- Accessible responsive unified inbox with loading, empty, error, success and offline states.
- Smart classification, invoice extraction, reminders and calendar suggestions with provenance.
- Apple Mail is a client, not a standalone provider; validate iCloud access separately.

## Delivery gates
Diagnose -> failing tests -> implementation -> local tests -> draft PR -> CI -> security review -> authorized merge/deploy -> production E2E. Do not merge or deploy with open P0.
