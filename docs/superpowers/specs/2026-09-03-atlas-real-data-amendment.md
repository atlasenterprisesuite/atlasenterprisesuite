# ATLAS Real Data Architecture Amendment

Date: 2026-09-03
Status: Approved by user
Applies to: `docs/superpowers/specs/2026-09-03-atlas-core-accounting-design.md`

## Decision

ATLAS must not use runtime demo data, seeded business records, fabricated financial metrics, simulated users, simulated organizations, or fake connected states.

If a real record, authenticated session, organization, permission, or integration is unavailable, the product must render an explicit truthful state such as `Authentication required`, `Organization required`, `Configuration required`, `No records`, or `Integration unavailable`.

Test fixtures are permitted only inside automated tests. They must never ship as runtime business data or appear as real company activity.

## Real backend

The active Supabase project `atlas-core` (`ggmanzcgtlrvqfoccgsh`) is the canonical persistence target for this implementation cycle.

Existing accounting and identity structures must be reused instead of duplicated. Verified existing public tables include:

- `organizations`
- `organization_members`
- `organization_role_permissions`
- `identity_permissions`
- `chart_of_accounts`
- `journal_entries`
- `journal_lines`
- `customers`
- `vendors`
- `invoices`
- `payments`
- `audit_logs`
- existing `accounting_*` operational tables

Existing RLS policies are the server-side authorization boundary. Frontend permission checks improve UX but never replace database authorization.

## Shell identity contract

Remove every runtime `demo` context and hard-coded tenant/organization/user identity.

The application shell resolves:

1. Supabase configuration from `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
2. The current authenticated Supabase user.
3. The user's active organization membership.
4. The organization record.
5. The user's role and permissions available through the real identity model.

The shell state is one of:

- `loading`
- `configuration_required`
- `authentication_required`
- `organization_required`
- `ready`
- `error`

Only `ready` exposes organization-scoped business routes and data actions.

## Accounting repository contract

Delete the planned runtime `DemoAccountingRepository` and `data/demo/accounting/seed.ts` from the implementation architecture.

`AccountingRepository` must be implemented against Supabase and the verified existing schema. Runtime reads and writes must carry the authenticated organization scope and rely on RLS.

The first real repository slice covers:

- chart of accounts reads
- journal header/line reads
- customer reads
- vendor reads
- invoice reads
- payment reads
- audit log reads where authorized

No invented rows are created to make dashboards look populated.

## Empty-state rule

A zero-row query is not replaced with seed data. The UI renders a truthful empty state and offers a real create/import action only when that action is implemented and authorized.

## Schema evolution

Do not create duplicate accounting tables. Any missing field or constraint must be added through a reviewed migration against the existing canonical tables. DDL is not applied to the live project until the migration is represented in the repository and its effects are understood.

## Testing

Unit and integration tests may use isolated fixtures or mocks. Fixtures must be clearly test-only and must not be imported by runtime application code.

Release gates include a source scan preventing runtime imports from `data/demo`, `seed`, or demo repositories.

## Production truthfulness

A successful local build or CI run does not mean the live backend is connected. Runtime is considered connected only when Supabase configuration is present, authentication succeeds, an organization is resolved, and a real query against the organization-scoped backend succeeds.
