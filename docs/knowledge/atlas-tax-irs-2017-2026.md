# ATLAS Tax IRS knowledge baseline — 2017–2026

This baseline separates tax year, filing year, publication date, effective date, and source status. It is operational product knowledge, not individualized tax advice.

## Current high-priority rules

- The 2026 filing season primarily processes tax year 2025 returns.
- Schedule 1-A carries new deductions for qualified tips, qualified overtime, qualified passenger-vehicle loan interest, and eligible seniors for tax years 2025–2028, subject to separate eligibility and phaseout rules.
- The federal third-party settlement organization Form 1099-K threshold was restored to more than $20,000 and more than 200 transactions; absence of a form does not make taxable income non-taxable.
- Information-return e-file is generally required at an aggregate 10 or more covered returns for filings required on or after January 1, 2024.
- The IRS announced that the legacy FIRE information-return system is transitioning to IRIS before the 2027 filing season; ATLAS must treat transmitter onboarding, format conversion, acknowledgments and correction workflows as a launch dependency.
- Tax year 2026 inflation parameters must remain separate from tax year 2025 return calculations.

## Decade map

| Tax year | Material federal change family | Primary ATLAS workflows |
|---|---|---|
| 2017 | Pre-TCJA baseline; TCJA enacted for later years | Historical calculation engine, amendments |
| 2018 | First broad TCJA implementation | 1040, itemized deductions, QBI, business depreciation |
| 2019 | Taxpayer First Act; SECURE Act enacted | E-file modernization, retirement distributions |
| 2020 | CARES Act emergency relief | Recovery rebates, payroll credits, ERC, retirement relief |
| 2021 | ARPA temporary expansions | CTC advances, dependent care, PTC reconciliation, paid leave |
| 2022 | Inflation Reduction Act and SECURE 2.0 enacted | Energy/vehicle credits, corporate rules, staged retirement rules |
| 2023 | IRA/SECURE 2.0 implementation; e-file regulations | Credits, retirement, information-return aggregation |
| 2024 | 10-return e-file mandate operational | IRIS/FIRE routing, corrections, acknowledgments |
| 2025 | Working Families Tax Cuts/OBBBA | Schedule 1-A, 1099-K, documentation and retroactive impact |
| 2026 | TY 2025 filing operations plus TY 2026 planning | Filing, prior-year amendments, inflation parameters |

## Official source registry

The machine-readable registry is `data/tax/irs-monitor/sources.json`. It is restricted to HTTPS pages on `irs.gov`. The monitor creates a baseline without alerting, then compares normalized content fingerprints and newly added text on later runs. A detected material change opens a review issue containing what changed, source status, detected/effective dates, affected workflows, and required human review.

## Activation gates

1. Confirm the change on the official IRS source.
2. Determine tax year, effective date, affected taxpayers and form revision.
3. Classify draft, proposed, final, transitional, expired, or superseded status.
4. Add versioned calculation/form rules without overwriting historical years.
5. Add positive, negative, boundary, phaseout and prior-year regression tests.
6. Require approval before production activation.

## Primary official references

- [IRS 2026 filing season](https://www.irs.gov/newsroom/irs-opens-2026-filing-season)
- [IRS Working Families Tax Cuts](https://www.irs.gov/newsroom/working-families-tax-cuts)
- [IRS Schedule 1-A](https://www.irs.gov/newsroom/schedule-1-a-additional-deductions-what-to-know-about-the-new-form)
- [IRS Form 1099-K FAQs](https://www.irs.gov/newsroom/form-1099-k-faqs-general-information)
- [IRS e-file information returns](https://www.irs.gov/filing/e-file-information-returns)
- [IRS FIRE-to-IRIS transition](https://www.irs.gov/newsroom/irs-reminder-information-return-e-file-system-transitioning-to-a-new-platform)
- [IRS inflation adjustments by tax year](https://www.irs.gov/newsroom/inflation-adjusted-tax-items-by-tax-year)
- [IRS TCJA hub](https://www.irs.gov/tax-cuts-and-jobs-act)
- [IRS coronavirus tax relief archive](https://www.irs.gov/coronavirus-tax-relief-and-economic-impact-payments)
- [IRS Inflation Reduction Act hub](https://www.irs.gov/inflation-reduction-act-of-2022)
- [IRS retirement COLA limits](https://www.irs.gov/retirement-plans/cola-increases-for-dollar-limitations-on-benefits-and-contributions)
