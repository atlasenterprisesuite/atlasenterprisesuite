# ATLAS Supabase v2 Migration Manifest

Canonical project: `atlas-core-v2` (`qawxltbplsxcjvwxdkes`)

This manifest records the exact migration version, name, SQL character count, and MD5 digest stored by `supabase_migrations.schema_migrations`. It is a drift-control artifact, not a substitute for mirroring the SQL files themselves.

| Version | Migration | SQL chars | MD5 |
| --- | --- | ---: | --- |
| 20260907174239 | atlas_foundation_v1 | 13875 | `814bcdc7a7a2f4f6eeca2f141fcc59b7` |
| 20260907174346 | harden_foundation_security_v1 | 2704 | `d77c4b2def251836c334ade69d3d62cf` |
| 20260907174412 | optimize_foundation_indexes_v1 | 1091 | `ce9f87dc5c7e35ac18cb41c12e746442` |
| 20260907174455 | service_bootstrap_tenant_v1 | 2229 | `cc36f91e3a504be26600a5ba95cad2c1` |
| 20260907174702 | atlas_foundation_self_check_v1 | 4280 | `591ab74d82e752f651e8113322025c18` |
| 20260907174738 | atlas_identity_context_v1 | 2037 | `85409cd9472398bebf16c4c5f00c6d31` |
| 20260907174751 | atlas_identity_self_check_v1 | 1628 | `83f4edc476d29f1670fd757807c09376` |
| 20260907192123 | atlas_accounting_ledger_core_v1 | 8699 | `6445214768fa49e1a3d40e29b877ab11` |
| 20260907192348 | atlas_accounting_ledger_governance_v1 | 22284 | `6676aa70534687b9f16ae218e45a98d7` |
| 20260907192503 | atlas_accounting_fk_index_alignment_v1 | 423 | `4e10056d1de6bed1a43c72bd59080413` |
| 20260907192544 | atlas_accounting_self_check_v1 | 5774 | `02377c7b25d1efaf0b61fc4cf2223261` |
| 20260907192735 | atlas_accounting_ar_ap_v1 | 16657 | `593effd6991f47629d1d51b7893a17f7` |
| 20260907193004 | atlas_accounting_ar_ap_governance_v1 | 34972 | `1aa49a6228ddb8a3394ad543996d417f` |
| 20260907193100 | atlas_accounting_ar_ap_self_check_v1 | 6659 | `8273669aa72858d8c6fd12f8b9edda22` |
| 20260907193251 | atlas_accounting_bank_reconciliation_v1 | 9648 | `35a789b3b0a6c1414d4f69ddd4e2cd6b` |
| 20260907193417 | atlas_accounting_bank_governance_v1 | 21083 | `7fc59d12376bdbf41316829f015e5673` |
| 20260907193459 | atlas_accounting_bank_self_check_v1 | 5367 | `ede3c84367ea18d13918ecc554680e33` |
| 20260907193647 | atlas_accounting_assets_close_v1 | 9189 | `4c5c43ff2530867d3bff4665b09e2f38` |
| 20260907193824 | atlas_accounting_assets_close_reports_governance_v1 | 24651 | `af3ee49dc72f5365265594827c26ba1c` |
| 20260907193846 | atlas_accounting_pnl_date_scope_fix_v1 | 1646 | `3e7449b5057f53d78dc708f36f7772af` |
| 20260907193928 | atlas_accounting_assets_close_self_check_v1 | 7066 | `14670de552f1658e47fcf10a000039c1` |
| 20260907203112 | fix_identity_rls_recursion_v1 | 2309 | `7c75083bc36bcb8f2bc725dc32d143a3` |
| 20260907203250 | fix_audit_correlation_uuid_v1 | 4533 | `25f309ed7e085f3505bf2d9db32045c5` |
| 20260907205806 | atlas_backend_gate_v1 | 1528 | `6f699041c55f53ece3ac4110913f5410` |
| 20260907205840 | harden_accounting_self_checks_service_execution_v1 | 1466 | `0118d9cc0d228e9075ad03e1a3a4e3e6` |

## Pending versioned migrations — not applied

The entries below exist in Git but are **not** claimed to exist in `supabase_migrations.schema_migrations` on the canonical project. They remain pending until a clean compatible non-production replay passes and production application is separately authorized.

| Version | Migration | SQL chars | MD5 | Truth state |
| --- | --- | ---: | --- | --- |
| 20260908203000 | atlas_release_train_v1 | 57633 | `21150b3689e06383aa83aee58810b814` | Versioned only; not applied |

## Verification rule

An applied migration mirror is accepted only when its normalized SQL matches the corresponding digest and character count recorded by `supabase_migrations.schema_migrations`, or when an intentionally transformed representation is reviewed and separately documented. Pending/versioned migrations must never be represented as applied until that database evidence exists. Do not silently replace an applied v2 migration with a legacy migration of the same purpose.
