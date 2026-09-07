# ATLAS Supabase v2 — Migration Mirror Evidence

Verification date: 2026-09-07
Canonical Supabase project: `atlas-core-v2`
Project ref: `qawxltbplsxcjvwxdkes`
Repository branch used for recovery: `infra/supabase-v2-migration-mirror`

## Truth state

The complete set of 25 migrations recorded in `supabase_migrations.schema_migrations` has been mirrored into `supabase/v2/migrations/`.

The historical SQL was recovered from the migration ledger's stored `statements` values. No migration was applied, replayed, rolled back, or otherwise executed against the canonical production-target database as part of this recovery operation.

Each repository file was verified byte-for-byte against the source ledger by computing the Git blob SHA-1 over the exact migration SQL (`blob <byte-length>\0<content>`) and comparing it with the blob SHA returned by GitHub.

Result: **25/25 exact blob matches; 0 mismatches.**

## Verified manifest

| Version | Migration | Git blob SHA-1 |
| --- | --- | --- |
| 20260907174239 | atlas_foundation_v1 | `e9bfe38f97a8e3bdc64d730436ac8d007acf4869` |
| 20260907174346 | harden_foundation_security_v1 | `459a44f9c782fdd0d9316d3d4d04059f3f6ec0c9` |
| 20260907174412 | optimize_foundation_indexes_v1 | `139e001d5e5fe7813891c90c11c6b312b032a548` |
| 20260907174455 | service_bootstrap_tenant_v1 | `bff18315e16fa8606905ae895c08ba75b26f048e` |
| 20260907174702 | atlas_foundation_self_check_v1 | `a088e16c4ca6f9ab76265fda1313afbe5c38131f` |
| 20260907174738 | atlas_identity_context_v1 | `d5e81c05ea251952eb74f106fb43079f852ceb2c` |
| 20260907174751 | atlas_identity_self_check_v1 | `51c1c8c9b82b69c347b7e5ce459d860210874d92` |
| 20260907192123 | atlas_accounting_ledger_core_v1 | `bef6ba068cd980058551875470f808b33fbbd293` |
| 20260907192348 | atlas_accounting_ledger_governance_v1 | `336a3e9105e93e758d507d7d90f6f4fb6584546c` |
| 20260907192503 | atlas_accounting_fk_index_alignment_v1 | `ec08f16a59b28a9d5ec14cc05c91ba2df038f711` |
| 20260907192544 | atlas_accounting_self_check_v1 | `5956716600668605f2b41cf06169d0b0148be38d` |
| 20260907192735 | atlas_accounting_ar_ap_v1 | `12851dff79d244129a756a5b4220a691148099cc` |
| 20260907193004 | atlas_accounting_ar_ap_governance_v1 | `6c18197e4e57301c293e2753959fe7a14d977aab` |
| 20260907193100 | atlas_accounting_ar_ap_self_check_v1 | `ab14f00e2951aa21e279162c4947284ff9d289cd` |
| 20260907193251 | atlas_accounting_bank_reconciliation_v1 | `6b06144f868b2c8059d638689c8f6fd1ac1dabcf` |
| 20260907193417 | atlas_accounting_bank_governance_v1 | `27d5a63b91d7898e2148708b04b075e944e8a2a9` |
| 20260907193459 | atlas_accounting_bank_self_check_v1 | `708e841ecfe3693fe95753c2e13febbae143bfb4` |
| 20260907193647 | atlas_accounting_assets_close_v1 | `2e42b7cf2b8de16c5079a41233f4e14addda2769` |
| 20260907193824 | atlas_accounting_assets_close_reports_governance_v1 | `305aeef1dcfd0dabf5a184e33c09569ebee441b9` |
| 20260907193846 | atlas_accounting_pnl_date_scope_fix_v1 | `bae3757bce22bd7f29d0965eaa354fd9aec99b93` |
| 20260907193928 | atlas_accounting_assets_close_self_check_v1 | `8ed3ba9c8c044c261e360ffea450ee4a2a7d2485` |
| 20260907203112 | fix_identity_rls_recursion_v1 | `f86e94f9f577078e3294d6db22ad05e22fa828b1` |
| 20260907203250 | fix_audit_correlation_uuid_v1 | `e1b6511ec7e013edffde48df9ad2a6dd51d44cf8` |
| 20260907205806 | atlas_backend_gate_v1 | `71d48b4d12030403b8b32f874c531aca8e55de6f` |
| 20260907205840 | harden_accounting_self_checks_service_execution_v1 | `5f4530b49b7d2e051852fd9c158cc6c03767e113` |

## Recovery gate interpretation

The repository mirror is now exact enough to support a clean replay test. This does **not** by itself authorize automatic production migration execution.

Before enabling `supabase db push` or equivalent production migration replay, ATLAS must still:

1. replay the 25 migrations from an empty compatible Supabase environment;
2. execute the Backend Gate and tenant-isolation/E2E checks against that replayed environment;
3. confirm generated schema/types match the expected v2 contract;
4. keep the canonical `atlas-core-v2` project untouched by the replay test;
5. record replay evidence before changing the production deployment workflow.
