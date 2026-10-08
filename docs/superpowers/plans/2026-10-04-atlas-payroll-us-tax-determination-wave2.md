# ATLAS Payroll — US Tax Determination Wave 2

Date: 2026-10-04
Branch: `feat/payroll-us-tax-determination-wave2`

## Goal

Add a deterministic, evidence-backed 2026 US federal payroll tax engine without overstating state/local coverage or regulated filing/payment capability.

## Authoritative sources

- IRS Publication 15-T (2026), Worksheet 1A and Annual Percentage Method tables for automated payroll systems.
- IRS Publication 15 (2026) for Social Security, Medicare and FUTA rules.
- IRS Topic 751 for Additional Medicare withholding.

## Supported production scope

- W-4 year 2020 or later.
- Regular wages only.
- Filing statuses: Married Filing Jointly; Single or Married Filing Separately; Head of Household.
- Weekly, biweekly, semimonthly and monthly payroll frequencies.
- FIT, employee/employer Social Security, employee/employer Medicare, Additional Medicare withholding, and gross FUTA.

## Fail-closed scope

- W-4 2019 or earlier.
- Nonresident alien withholding adjustments.
- Supplemental wage methods.
- FICA-exempt or otherwise special employment-tax treatment.
- State/local income tax and unemployment tax.
- FUTA credit/net liability without state unemployment evidence.
- Filing, remittance and disbursement.

## TDD sequence

1. Add a RED integration contract requiring a 2026 federal rule pack, W-4 snapshots, immutable tax determinations, deterministic calculator, source provenance, rule checksum and fail-closed unsupported cases.
2. Implement additive migration and seed a platform federal 2026 rule pack with explicit `coverage_level=federal_standard_employee`.
3. Keep top-level payroll tax readiness blocked unless full US payroll-tax coverage exists; federal-only readiness must never imply state/local readiness.
4. Add regression vectors covering all filing statuses, Step 2 checkbox behavior, W-4 credits/additional withholding, Social Security wage-base crossing, Additional Medicare threshold crossing and FUTA wage-base crossing.
5. Require same-SHA CI, code review, merge, Supabase migration, Cloudflare deploy and global production verification.

## Acceptance criteria

- Federal 2026 rule source/provenance is versioned and checksummed.
- Calculator reproduces IRS Worksheet 1A percentage-method behavior for supported inputs.
- Unsupported tax profiles fail closed with explicit reason codes.
- FICA/FUTA calculations respect YTD wage bases.
- FUTA credit is never assumed without evidence.
- Determination records reference immutable rule/election/input snapshots.
- Existing Payroll and Wave 1 tests remain green.
- Overall `tax_determination` readiness remains P0 blocked while state/local coverage is absent.
