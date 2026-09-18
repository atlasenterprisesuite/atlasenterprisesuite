# ATLAS Advisory Office

Status: implementation baseline
Canonical repository: atlasenterprisesuite/atlasenterprisesuite
Branch: feat/advisory-office

## Architecture

ATLAS Advisory Office is a protected Business subsystem. AW Finance Advisory Solutions is Firm #001, not a separate platform.

Hierarchy: Organization → Firm → Client → Engagement → Service/Task → Time/Expense → Invoice/Payment references.

Advisory owns firm/client linkage, engagements, service catalog and launch workflow. CRM remains the prospect/opportunity boundary. Finance/Accounting remains the financial source of truth. Identity supplies organization scope and authentication. External document, e-sign, print, media, payment and publishing providers remain fail-closed until authorized and verified.

## Business Launch 360

Phases: Foundation → Brand → Website → CRM & Sales → Brand, Print & Promotional Launch → Marketing → Launch → 30-Day Review.

Launch Readiness is evidence-based across business setup, brand, website, contact channels, CRM, payments, accounting, marketing, compliance and analytics. Each verified dimension contributes 10 points. Missing evidence never receives credit.

Brand, Print & Promotional Launch covers approved brand assets, business cards, flyers/brochures, posters/banners, apparel/uniforms, stickers/labels, promotional items, QR assets, storefront/vehicle concepts and sales offer assets. Physical production requires proof approval before ordering. Ordered/fulfilled states require provider evidence or verified manual entry.

## Security

All protected resources carry organizationId and firmId. Organization scope is derived from authenticated identity, never trusted from arbitrary client input. Client portal scope is deny-by-default. Billing and sensitive sharing require explicit permissions/approval.

## Truthfulness

No client, revenue, invoice, payment, readiness, provider-connected, printed, shipped or fulfilled state may be fabricated. Empty states are valid production states.

## Release gates

Typecheck, unit tests, integration tests and production build must pass before merge. Deployment and production verification remain separate evidence gates.
