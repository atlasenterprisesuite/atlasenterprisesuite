# ATLAS Pay Public Experience — Design

Date: 2026-10-06
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Owner: ATLAS Finance / ATLAS Pay

## Decision

Expose ATLAS Pay publicly as a product experience at `/finance/pay` while moving the authenticated operational dashboard to `/finance/pay/workspace`.

The public surface explains the product without exposing balances, internal provider records, RBAC state, account identifiers, or financial evidence. It presents:

- ATLAS Wallet
- Accounts Center
- Earnings & Rewards
- Payout Hub
- ATLAS Issuing
- Security & Compliance
- Financial Network

## Truth boundary

The public page must not claim:
- live custody;
- live issuing;
- approved money movement;
- deposit insurance;
- verified provider connectivity;
- settlement;
- customer balances.

Calls to action:
- **Get started** → authenticated ATLAS Pay workspace.
- **Sign in** → identity route with return destination to `/finance/pay/workspace`.

## Routing

- `/finance/pay` — public product page on production/local public hosts.
- `/finance/pay/workspace` — authenticated operational dashboard.
- Existing ATLAS Pay provider/data model remains unchanged.

## Visual direction

Futuristic ATLAS product page with:
- dark spatial gradient background;
- luminous ATLAS card/wallet centerpiece;
- modular capability cards;
- visual financial-network rail;
- responsive desktop/tablet/mobile behavior;
- reduced-motion support.

No copied third-party branding, logos, or assets.
