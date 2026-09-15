# ATLAS Supabase Unindexed Foreign-Key Classification

Date: 2026-09-14 UTC
Project: authoritative `atlas-core` (`ggmanzcgtlrvqfoccgsh`)
Advisor finding: `unindexed_foreign_keys` = 27

## Decision

Do **not** create all 27 indexes merely to silence the advisor.

Fresh production inspection shows the affected relations are currently tiny and essentially inactive. The 27 findings are therefore classified as **preventive performance debt**, not a current production blocker.

## Fresh evidence

Total relation sizes for the affected tables are approximately 24–40 KB. Current table statistics show only a handful of scans and essentially no write activity.

Exact row counts at classification time:

| Table | Rows |
| --- | ---: |
| `accounting_budget_lines` | 0 |
| `accounting_budgets` | 0 |
| `accounting_consolidation_adjustment_lines` | 0 |
| `accounting_consolidation_adjustments` | 0 |
| `accounting_consolidation_groups` | 0 |
| `accounting_consolidation_members` | 0 |
| `accounting_fx_rates` | 0 |
| `accounting_intercompany_matches` | 0 |
| `journal_entries` | 0 |
| `atlas_user_preferences` | 1 |

The 27 current advisor findings are distributed across those relations. No affected relation currently has enough data or workload to demonstrate a material FK-index bottleneck.

## Index policy

Create a missing FK index only when at least one of these conditions is supported by fresh evidence:

1. the child table has grown enough that parent DELETE/UPDATE FK checks are measurable;
2. application queries materially filter/join on the FK column and execution plans show sequential-scan cost;
3. production latency or database telemetry identifies the relationship as a hot path;
4. a realistic load test demonstrates a meaningful improvement;
5. a table-growth forecast makes the index clearly necessary before launch.

For tenant-critical `org_id`, accounting `entity_id`, journal-line/account references, and other likely future hot paths, reassess as real business data arrives rather than waiting for an incident.

## Explicit non-action

- No 27-index bulk migration was applied.
- No existing index was dropped.
- The 232 `unused_index` findings remain informational and must not be mass-deleted without workload history.

## Recheck trigger

Re-run this classification when any affected table exceeds a meaningful production row threshold, when write/delete activity begins, before high-volume commercial onboarding, or when query plans/latency indicate a hot path.