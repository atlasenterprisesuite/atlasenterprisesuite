# ATLAS Advisory Office + Business Launch 360 Design

Status: Approved
Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`
Firm #001: AW Finance Advisory Solutions

## Architecture

ATLAS Advisory Office is a protected Business subsystem, not a parallel enterprise platform. It owns the Firm, Client and Engagement domain while reusing ATLAS Identity/RBAC, CRM, Finance/Accounting, Creator/Studio, Sites, execution/approval, audit and provider boundaries.

Canonical hierarchy:

`Organization → Firm → Client → Contact → Engagement → Service/Matter → Task → Time/Expense → Invoice → Payment`

Every persisted resource is organization scoped. `organization_id` is derived from authenticated ATLAS identity, never trusted from arbitrary browser input. Firm scope is enforced in addition to organization scope.

## AW Finance bootstrap

The first firm is `aw-finance-advisory-solutions`, firm number `001`, status `active`, platform `ATLAS Advisory Office`. This bootstrap does not create clients, engagements, invoices, revenue or readiness evidence.

## Business Launch 360

Business Launch 360 is an engagement service with phases Foundation, Brand, Website, CRM & Sales, Brand/Print/Promo, Marketing, Launch and 30-Day Review.

Launch Readiness is evidence based across business setup, brand, website, contact channels, CRM, payments, accounting, marketing, compliance and analytics. Missing evidence scores zero for that dimension.

Brand, Print & Promotional Launch supports brand kits, business cards, flyers/brochures, posters/banners, apparel/uniforms, labels/stickers, promotional items, QR assets, storefront/vehicle concepts and sales assets. Physical production remains provider gated. A mockup is never evidence of ordering, shipment or fulfillment.

## Billing and regulated boundaries

Advisory links invoices/payments by firm, client and engagement but does not create a second ledger. Accounting remains authoritative. Final documents, invoice issuance, engagement closure, sensitive sharing and consequential financial actions require explicit authorization/approval.

ATLAS does not claim a firm or user is a CPA firm, RIA, broker-dealer, law firm, insurance agency, enrolled-agent practice or other regulated provider without verified authorization.

## Portal and roles

Client Portal is separate from the internal workspace and exposes only authenticated client-authorized resources. Internal CRM notes, margins, audit internals and other clients are never exposed.

Roles: Firm Owner, Firm Admin, Advisor, Accountant/Bookkeeper, Reviewer, Staff, Billing, Client, Client Delegate, Read-only Auditor.

## Truthful state

The first merge may expose the domain model and protected Advisory surface while durable client/engagement persistence, billing execution, portal persistence and vendor ordering remain visibly gated until their authenticated backend contracts and tests exist. No UI may fabricate production readiness.
