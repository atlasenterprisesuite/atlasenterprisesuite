# ATLAS Hospitality Discover Execution Roadmap

This roadmap sequences the approved Discover & Local Commerce specification into independently testable implementation plans.

Canonical specification: `docs/superpowers/specs/2026-09-12-atlas-hospitality-discover-local-commerce-design.md`

Execution order:

1. `2026-09-12-atlas-hospitality-discover-core.md`
   - domain types and permissions;
   - provenance/freshness;
   - Supabase catalog/RLS;
   - organic search;
   - read Edge Function;
   - visitor list/detail routes.

2. `2026-09-12-atlas-hospitality-source-governance.md`
   - rights-aware source adapters;
   - idempotent ingestion;
   - corrections/deletions/conflicts;
   - media validation/storage references;
   - source and media moderation.

3. `2026-09-12-atlas-hospitality-map-concierge.md`
   - geospatial filtering;
   - map provider boundary;
   - synchronized map/list;
   - property concierge;
   - QR/deep links.

4. `2026-09-12-atlas-hospitality-local-commerce.md`
   - offers;
   - inventory/eligibility;
   - redemption transaction;
   - visitor Deals UI.

5. `2026-09-12-atlas-hospitality-partners-campaigns-analytics.md`
   - partner management;
   - verification/review;
   - sponsored campaign separation;
   - attribution;
   - observed analytics;
   - partner UI.

6. `2026-09-12-atlas-hospitality-assistant-integrations.md`
   - itinerary engine;
   - saved itineraries;
   - ATLAS Assistant tool contract;
   - Ride/Pay/CRM/Creator/Accounting handoffs;
   - English/Spanish/Portuguese UI architecture;
   - accessibility-critical verification;
   - final source/readiness gates.

Dependency rules:

- Plans 2–6 depend on Plan 1.
- Plan 2 should precede production catalog ingestion and partner media publication.
- Plan 4 does not require a map provider to function.
- Plan 5 can begin after Plan 1; campaign-to-offer references are enabled only after Plan 4 contracts exist.
- Plan 6 can begin itinerary/Assistant read-only work after Plan 1; offer, campaign, Ride, Pay, CRM, Creator, and Accounting capabilities remain fail-closed until their corresponding contracts are present and verified.
- Hospitality Access is not modified except shared navigation/shell integration that preserves every existing Access route and permission boundary.
- Production deployment is never inferred from a passing build or CI workflow. Public production verification remains a separate gate.
