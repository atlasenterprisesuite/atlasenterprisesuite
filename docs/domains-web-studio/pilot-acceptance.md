# ATLAS Domains & Web Studio — 777 REVIEW pilot acceptance

## Verified from repository changes
- [x] Isolated static HTML pilot committed on a feature branch.
- [x] Automated contract tests added (execution result not yet verified).
- [x] Pull request #820 opened as draft.
- [x] Dedicated PR workflow defined (run status not yet verified).

## P0 release gates — fail closed
- [ ] Run automated tests and inspect passing GitHub Actions run.
- [ ] Desktop browser test at 1440px: layout, text, keyboard navigation, form, contrast.
- [ ] Mobile browser test at 375px: no horizontal scroll, form usability, touch targets.
- [ ] Integrate into existing React app routing, authentication and organization boundaries.
- [ ] Add a real registrar availability/pricing API with server-side authentication, audit logs and rate limits.
- [ ] Keep purchase, DNS changes and email provisioning disabled until authorized provider contracts, billing and explicit checkout confirmation exist.
- [ ] Deploy to an isolated test subdomain after DNS ownership and deployment permissions are verified.
- [ ] Validate TLS, security headers, error states, access controls, route checks and exact deployed SHA.
- [ ] Verify no production regression, then review and merge.

## P1 follow-up
- [ ] Localize English and Spanish.
- [ ] Add user-tested AI website creation and template editing.
- [ ] Add mailbox provider and SPF/DKIM/DMARC setup.
- [ ] Add billing, renewal and cancellation lifecycle.

**Status: PROTOTYPE / NOT DEPLOYED.** A static demonstration is not a domain registrar, mailbox provider or live site builder.
