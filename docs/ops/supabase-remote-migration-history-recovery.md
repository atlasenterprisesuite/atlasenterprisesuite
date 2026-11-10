# Supabase remote migration history recovery

The Supabase GitHub Preview integration reported:

`Remote migration versions not found in local migrations directory.`

This repair restores every remotely applied production migration version that was absent from Git, using the SQL statements recorded in `supabase_migrations.schema_migrations`.

This commit does **not** execute or alter production DDL. It restores migration-history files only. Existing local migration files are intentionally preserved in this first recovery stage so Preview can report the next precise reconciliation condition, if any.

Production migration project: `ggmanzcgtlrvqfoccgsh`.
Recorded production migrations: 319.
Restored remote versions: 300.
