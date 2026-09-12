# ATLAS Automotive Sales Financial Reporting

Status: implemented first functional slice with deterministic demo data; production adapters not connected
Last reviewed: 2026-09-07
Primary owner: ATLAS Finance -> Accounting -> Reports
Secondary integrations: CRM/Sales, Inventory/VIN, POS/Deal Desk, F&I, Banking, Tax, ATLAS Pay

## Objective

Provide automotive dealerships and dealer groups with a governed departmental financial view that reconciles vehicle sales, finance-and-insurance income, fixed operations, inventory carrying position and floorplan economics without creating a parallel accounting system.

Canonical route:

`/finance/accounting/reports/automotive-sales`

The report reuses ATLAS Core tenant scope, RBAC and Accounting contracts. Production data must flow into the same accounting source of truth rather than hard-coded dashboard totals.

## Reporting model

Variable operations:

- new vehicle retail sales
- used vehicle retail sales
- used vehicle wholesale sales
- vehicle revenue
- net vehicle cost
- front-end gross profit
- gross margin
- average selling price per unit
- gross profit per unit

F&I:

- finance reserve revenue
- service contract revenue
- protection product revenue
- other F&I revenue
- chargebacks
- F&I net revenue
- F&I net revenue per retail unit

Fixed operations:

- service
- parts
- collision
- revenue
- cost of sales
- gross profit
- gross margin

Inventory and floorplan:

- new/used units on hand
- carrying value
- floorplan payable
- days supply
- manufacturer holdback
- floorplan assistance
- advertising assistance tied to inventory
- unit/program incentives
- floorplan interest expense
- net inventory carrying cost

## Accounting guardrails

1. Vehicle revenue is recognized only when the sale contract is complete, financing/collectibility is supportable, and control of the vehicle transfers to the customer.
2. Trade-in consideration must not be counted as an additional sale on top of the vehicle contract transaction price.
3. F&I is reported net of chargebacks in the reporting engine. Wholesale deals are excluded from retail F&I-per-unit metrics.
4. Manufacturer holdbacks, floorplan assistance, non-reimbursement advertising support and eligible incentives tied to specific vehicles are treated as reductions of inventory/cost of sales when earned and the related vehicle is sold.
5. Floorplan assistance is visible as part of vehicle economics, while floorplan interest expense is tracked separately. The report does not add assistance a second time to consolidated gross profit.
6. New/used inventory supports specific-identification style carrying economics in the operational contract; tax LIFO remains a separate tax/accounting-method concern and must not overwrite operational VIN-level cost records.
7. Fixed operations remain separate profit centers. Internal parts/service work used to recondition inventory requires elimination/transfer-price controls before consolidated reporting so ATLAS does not fabricate profit from interdepartmental work.
8. Production metrics require real source data. Demo fixtures are labeled DEMO and cannot be represented as dealership production performance.

## External benchmark research

The design was benchmarked against current public automotive retailers and U.S. tax guidance:

- Lithia Motors 2025 Form 10-K: vehicle revenue recognition at contract/financing/control transfer; F&I net of estimated chargebacks; manufacturer support reduces carrying value/COGS when the vehicle is sold. https://www.sec.gov/Archives/edgar/data/1023128/000102312826000015/lad-20251231.htm
- AutoNation 2025 Form 10-K: departmental revenue/gross profit, gross profit per vehicle retailed, inventory days supply, floorplan liabilities and manufacturer credits. https://www.sec.gov/Archives/edgar/data/350698/000162828026007800/an-20251231.htm
- Group 1 Automotive 2025 Form 10-K: new/used/wholesale, parts and service, F&I and gross-margin reporting. https://www.sec.gov/Archives/edgar/data/1031203/000103120326000064/gpi-20251231.htm
- Sonic Automotive 2025 Form 10-K: fixed operations and F&I gross profit per retail unit; floorplan assistance accounting. https://www.sec.gov/Archives/edgar/data/1043509/000162828026010570/sah-20251231.htm
- IRS Rev. Proc. 97-36: Alternative LIFO Method for qualifying retail automobile dealers. https://www.irs.gov/pub/irs-irbs/irb97-33.pdf
- IRS Rev. Proc. 2001-23: Used Vehicle Alternative LIFO Method. https://www.irs.gov/pub/irs-irbs/irb01-10.pdf
- IRS Rev. Proc. 2022-14 / Form 3115 guidance: accounting-method changes for new and used vehicle LIFO methods. https://www.irs.gov/irb/2022-07_IRB

## Production integration contract

Required source adapters before this report can be called production-connected:

- DMS/deal jacket: deal close, transaction price, deal status, stock/VIN, trade-in and delivery evidence
- Inventory: VIN-level carrying cost, transportation, reconditioning and inventory status
- OEM/program data: holdback, incentives, floorplan and advertising assistance with earning criteria
- F&I/lender: reserve, VSC/protection product commissions, cancellations and chargebacks
- Fixed operations: repair orders, parts tickets, collision and internal reconditioning
- GL: journal references and departmental account mapping
- Banking/floorplan: lender balances and interest expense
- CRM/Sales: customer/deal lifecycle references without becoming the accounting source of truth
- Supabase: tenant-scoped persistence, RLS, audit history and verified source metadata when the production backend is authorized

Every adapter must preserve `tenant_id` and `organization_id`. Sensitive writes require backend authorization and audit events.

## Next gates

1. Connect persistent Supabase tables and RLS to the existing ATLAS accounting tenancy contract.
2. Define dealer chart-of-accounts mappings and journal generation rules.
3. Add deal-to-GL reconciliation and exception queue.
4. Add F&I chargeback reserve/actual reconciliation.
5. Add internal reconditioning elimination controls.
6. Add same-store vs reported views for multi-location dealer groups.
7. Add contracts-in-transit/funding aging and lender reconciliation.
8. Add export only after CSV/PDF generation is implemented and tested.
9. Add production smoke tests and route verification before any live/connected badge is enabled.
