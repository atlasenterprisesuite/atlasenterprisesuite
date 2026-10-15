# ATLAS Mail — Architecture Decision Record (Issue #795)

Date: 2026-10-15
Status: Proposed / provider-gated. Not deployed.
Decision: Build a first-party multi-tenant business mail product on existing ATLAS identity, Connect, Work OS, billing and audit boundaries. Use an explicitly licensed specialist mailbox provider for transport and mailbox hosting.

## Reuse evidence
- `docs/architecture/ATLAS_WORK_OS.md` places Mail behind ATLAS Connect / external provider authorization.
- `apps/web/src/work/WorkOSPage.tsx` marks Mail as gated; do not change to active without server-verified readiness.
- Existing core Google integration permissions are for user-authorized external connections, not a wholesale mailbox hosting entitlement.

## Provider procurement gates
Evaluate licensed mailbox provisioning API, reseller/white-label rights, custom domains, SMTP/IMAP/webmail, inbound delivery, outbound reputation, quotas, backups and restore tests, export/migration, incident response, abuse controls, SLA, support, data residency, and total cost per seat. Hostinger promotional retail pricing does not prove wholesale resale permission. No purchase without explicit budget authorization.

## Domain and mailbox lifecycle
1. Authenticated tenant admin requests domain. Create pending record scoped to tenant.
2. Issue unpredictable ownership TXT challenge; independently verify authoritative DNS. Fail closed on mismatch, expiry or timeout.
3. Verify SPF, DKIM, DMARC and provider MX prerequisites. Show missing checks; never claim operational mail prematurely.
4. Provision through idempotent provider adapter after authorization, MFA and billing entitlements.
5. Store provider identifiers and encrypted credentials through established ATLAS secret boundaries, never client-side.
6. Suspend, delete and export with retention policy, audit trail, revocation and recoverable backup process.

## Minimum model (design only, no migration applied)
- mail_domains(id, tenant_id, domain_ascii, verification_state, challenge_hash, provider_id, timestamps)
- mail_mailboxes(id, tenant_id, domain_id, local_part, provider_mailbox_id, state, quota_bytes)
- mail_aliases(id, tenant_id, mailbox_id, alias_address)
- mail_provisioning_jobs(id, tenant_id, idempotency_key, state, provider_request_id)
- mail_audit_events(id, tenant_id, actor_id, action, target_id, timestamp)
Tenant foreign keys and RLS must be verified in tests; provider credentials never in these tables.

## TDD acceptance scenarios (must be written before production code)
- Tenant A cannot read/change Tenant B's domain, mailbox, aliases or jobs.
- Non-admin cannot provision; privileged mutation requires MFA.
- Invalid/expired TXT or SPF/DKIM/DMARC failure cannot report active readiness.
- Provider timeout and duplicate requests do not create duplicate paid mailboxes.
- Spam, attachment scanning and abuse rate limits fail closed.
- AI cannot inspect messages without explicit tenant/user permissions.
- Disabled tenant cannot send/receive through ATLAS control plane.
- Billing, quota, export and backup restore reconcile with provider state.
- Keyboard and screen-reader webmail workflows and mobile responsive layout pass.

## Delivery sequence
ADR review → provider matrix and contractual validation → tests → migration/RLS → provider adapter → admin UI → webmail → billing → CI → PR → reviewed merge → deployment → production E2E + exact-SHA.

P0: authorization, tenant isolation, verified DNS, secret handling, abuse controls, provider truth, production integrity. P1: documented UX refinements and noncritical enhancements.
No LIVE or launch claim until evidence is linked in issue #795.
