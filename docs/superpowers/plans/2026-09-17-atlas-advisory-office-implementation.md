# ATLAS Advisory Office Implementation Plan

Status: durable core completed

1. Completed: Advisory domain package, Firm/Client/Engagement contracts, Business Launch 360, readiness and Brand/Promo governance.
2. Completed: canonical Advisory permissions and protected routing.
3. Completed: AW Finance Firm #001 bootstrap inside authenticated organization scope.
4. Completed: Supabase RLS persistence for firms, memberships, clients, engagements, launch evidence and audit events.
5. Completed: authenticated client and engagement creation through server-side RPC boundaries.
6. Completed: Business Launch 360 evidence persistence and evidence-based readiness scoring.
7. Completed: full Advisory sub-navigation with truthful fail-closed boundaries for external/provider-backed functions.
8. Completed: focused unit/integration contracts, router cleanup and Advisory CI coverage.
9. Release: merge only after current CI is green; production remains unverified until the deployment workflow and public route checks pass.

Provider-backed e-sign, print fulfillment, paid media, payments, calendar and publishing cannot be truthfully marked complete without external authorization. Those boundaries remain closed rather than simulated.
