# ATLAS Sovereign Domains & Web Studio — Architecture Decision 001

Status: APPROVED DIRECTION / IMPLEMENTATION NOT COMPLETE
Decision: Own the application code, tenant control plane, DNS orchestration, site builder, hosting orchestration, billing ledger, mail management and observability. Do not adopt reseller subscriptions or white-label platforms as a product dependency.

## Reality and non-negotiable boundaries
- Public internet service cannot be literally third-party-free: domains require registry/ICANN ecosystem, internet transit, IP allocations and physical infrastructure. Even owned servers have power, connectivity, hardware and operational costs.
- Direct domain registration requires applicable registrar accreditation/registry contracts or other authorized registry arrangements; do not sell registrations before authorization.
- Self-hosted email requires reputable IP space, reverse DNS, SPF, DKIM, DMARC, abuse response, spam controls, queueing, backups and deliverability testing. No production mail claims before verification.
- Own code does not imply zero costs. No recurring reseller fees is a design goal, not a guaranteed outcome.
- Existing Cloudflare/Supabase/GitHub dependencies are transitional; migration must be proven before removing them.

## Ownable components and sequence
1. **Foundation**: organization-scoped RBAC/RLS, MFA for privileged actions, encrypted secrets, immutable audit events, job queue, idempotency keys, backups/restore drills, metrics, security incident response.
2. **DNS authority**: versioned zones, validated records, change approval, signing/DNSSEC, redundant authoritative nameservers on independent networks, health and propagation checks; no destructive changes before explicit authorization.
3. **Website platform**: isolated tenant builds, visual editor, templates, static hosting, TLS issuance/renewal, storage, quotas, rollback, custom domains, abuse mitigation.
4. **Mail platform**: mailbox provisioning, SMTP submission and inbound MX, IMAP/webmail, spam/virus protection, DKIM/SPF/DMARC, backup, migration and deliverability gates.
5. **Commerce**: catalog, tax/pricing, invoices, double-entry ledger, renewal/cancellation/refund lifecycle; payment acceptance still requires lawful payment rails or licensed infrastructure.
6. **Domain registry connectivity**: registry integration via authorized contracts, EPP where applicable, contact validation, lifecycle, transfer/renewal, RDAP, compliance and escrow requirements.
7. **Migration**: dual-run and evidence-based cutover away from current hosted services only after SLOs, restore tests, security review and independent availability are confirmed.

## Commercial release gates (all P0)
- Tests, typecheck, build, threat model and external security assessment passed.
- Real end-to-end domain search/order/provisioning, site publication, mailbox send/receive, payment settlement and renewal/refund tests.
- Operational contracts/approvals, abuse desk, support and incident runbooks in place.
- Mobile and desktop accessibility; monitoring and recovery exercises; exact-SHA deployment evidence.
- Zero unverified 'ready for sale' claims. Keep existing pilot non-transactional until all gates pass.

## Decision rationale
User explicitly prioritizes long-term technological independence and avoiding third-party reseller subscriptions over immediate launch. Implement first-party components, but clearly distinguish unavoidable internet ecosystem dependencies and costs.
