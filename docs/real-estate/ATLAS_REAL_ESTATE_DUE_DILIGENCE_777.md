# ATLAS Real Estate Intelligence — 777 REVIEW

## Scope and evidence

This is a new **partial** ATLAS module inside the canonical monorepo, not a separate product, bank, lender, MLS or title company. Its first vertical slice allows manually entered scenarios and a 24-item pre-acquisition checklist. It does **not** save deals remotely, import ownership, run credit, scrape listings, verify official records, originate loans, escrow deposits, certify inspections or close transactions.

Source of truth: the **verified organization and property** will eventually be joined through a tenant-scoped canonical property ID, never through untrusted browser cache. The existing Hospitality Properties page deliberately displays no verified catalog.

UI route: `/real-estate`, with a link from `/hospitality/properties`. The calculator is public and browser-local: inputs and review statuses are not transmitted or persisted. Until governed storage exists, exiting the page discards work.

## Lifecycle

1. **Find:** collect listing origin, seller authority, parcel ID, permitted use, unit mix and comparable sales, provenance timestamp.
2. **Verify:** independently reconcile deed, survey, liens, easements, zoning, taxes, special assessments, code violations and tenant records.
3. **Analyze:** calculate potential gross income, vacancy-adjusted income, operating expenses, NOI, debt service, DSCR, cap rate, cash-on-cash, cash required to close, and financial risks. Ongoing taxes, insurance, association fees, and capital reserve must be modeled separately.
4. **Inspect:** obtain structural, roof, HVAC, electrical, plumbing, pests, environmental and insurer inspections. Record estimates and contractor evidence.
5. **Fund:** review the borrower's authorized prequalification and real lender terms; financing status must be sourced from the lender and remain separate from simulated payment calculations.
6. **Contract:** review contingencies, earnest money, due-diligence window, appraisal, title objections, termination rights, closing costs and proof of funds.
7. **Close:** independent title/escrow verification, wire fraud prevention, recording and transfer taxes, prorations, insurance binding and legal review.
8. **Operate:** leases, management, reserves, maintenance, insurance renewals, property tax calendar, accounting and tenant-compliant processes.

## Non-negotiable P0 controls

- No synthetic property appears as genuine inventory or existing ATLAS-owned real estate.
- Missing tax/insurance values are highlighted, not treated as certified zero.
- Missing or incident-marked P0 checks block the manual readiness state.
- Reviewing all tasks manually **never** constitutes independent verification or investment approval.
- No transfer, real credit inquiry, seller contact, third-party action or contract submission from this module.
- Financial output is scenario analysis only, not lending or investment advice.
- No stored sensitive financial information or third-party data outside a verified tenant-scoped system.
- All future write APIs require authentic organization identity, RBAC, RLS, immutable audit and provenance links.
- No automatic external action and no release without exact-HEAD CI, security review and verified route/edge deployment.

## Providers and integration backlog

### Records / government
- Parcel and assessed value: county Property Appraiser; county Tax Collector for bills, liens, delinquencies and special assessments. Do not confuse current seller exemption/assessment with the buyer's future tax basis.
- Building and zoning: city or county permitting, land development, code enforcement and recorded plats; apply jurisdiction determined by verified parcel.
- Other records: clerk of court (recorded deeds, liens), FEMA flood information, documented HOA/condominium sources and reliable environmental information.

### External professional verification
- Licensed title/closing agent, inspector, contractor, insurance broker, lender and tax/legal professionals as applicable.
- Every verification must attach source, record timestamp, responsible identity, document hash and expiration/recheck rule; a selected checkbox is insufficient.

### Commercial data
- MLS and off-market brokers only through explicit licensed connections; listing terms/ownership rights must be respected.
- Rent roll, leases, deposits and T12 statements through documented owner-authorized integrations.
- Credit and loan readiness only with appropriate user authorization and compliant providers; distinguish soft inquiry, hard inquiry and prequalification.

### Backend
- Design future tables `real_estate_properties`, `real_estate_deals`, `real_estate_deal_inputs`, `real_estate_due_diligence`, `real_estate_evidence` and append-only `real_estate_audit_events`.
- Mandatory `org_id` and authenticated actor for records, tenant-scoped RLS, RBAC and a durable relation to canonical Hospitality property ID when verified. No dual property catalog.
- Preserve historic underwriting snapshots and exact source hash; never modify a past investment decision silently.
- Keep external-provider status explicit: `not_connected`, `configured_unverified`, `verified`, `stale`, `failed`.

## Calculation definitions

```
Gross potential income = 12 × (units × monthly_rent_per_unit + monthly_other_income)
Effective income = gross_potential_income × (1 - vacancy_pct / 100)
Operating expenses = 12 × (monthly_other_opex + monthly_hoa) + annual_property_tax + annual_insurance
NOI = effective_income - operating_expenses
Monthly debt payment = ordinary fixed-rate fully amortizing monthly principal + interest payment
Annual debt service = 12 × monthly_debt_payment
Annual cash flow = NOI - annual_debt_service - 12 × monthly_capex_reserve
Initial cash required = down_payment + closing_costs + loan_fees + repairs + initial_cash_reserves
Cap rate = NOI / purchase_price
DSCR = NOI / annual_debt_service (N/A when all-cash)
Cash-on-cash = annual_cash_flow / initial_cash_required (N/A when denominator = 0)
```

This is simplified fixed-rate amortization; it excludes interest-only, balloon/refinancing, adjustable rates, taxes on income, depreciation, tax credits, seller credits, tax prorations and uncertain future appreciation. Future advanced cases must be isolated formulas, tested and labeled rather than silently using the amortization assumptions above.

## Verification instructions

- `npm run typecheck`
- `npm test -- tests/unit/real-estate-underwriting.test.ts tests/unit/real-estate-diligence.test.ts`
- `npm test`
- `npm run build`
- Verify `/real-estate` and the `/hospitality/properties` link in a real browser, both authenticated and anonymous contexts.
- Verify mobile layout, keyboard controls, invalid inputs, zero interest, all-cash, loan stress, missing tax/insurance, incident gate, and lack of false readiness.
- Confirm PR exact-SHA required checks and independently verify production **only after** authorized merge/deployment.

## Acceptance status

New module source, tests, routes and checklist are implementation artifacts only. Their existence is not evidence that CI, merge, provider verification or production deployment succeeded. P0 remains fail-closed until independently proven.
