# ATLAS Advisory Office Implementation Plan

Status: In progress

1. Establish Advisory domain package with Firm/Client/Engagement contracts, Business Launch 360, evidence readiness, billing bridge types and Brand/Promo proof state machine.
2. Register Advisory permissions in canonical core permissions.
3. Add protected `/advisory` route and AW Finance Firm #001 route through the existing extension resolver.
4. Register Advisory in the canonical module registry/navigation.
5. Add truthful Advisory Office UI with zero-state metrics and explicit persistence/provider gates.
6. Unit-test tenant+firm isolation, readiness evidence and print proof ordering.
7. Add route/registry integration coverage.
8. Open PR against `main`, run repository CI, fix blocking findings.
9. Durable persistence, portal, accounting event execution and vendor integrations remain gated follow-on slices unless their canonical backend contracts already exist and can be reused without inventing a second source of truth.

Production is not declared from code merge alone. Deployment and public-route verification remain separate evidence gates.
