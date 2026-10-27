# Signal Intelligence 777 — schema forensics checkpoint (2026-10-27)

Baseline SHA: 5a3af77556069bef9ccfc15fae973206bed6482c. Subsequent code hardening: ae30e4593810fde30677cbc9541e9a2e8da1a741.

## Evidence retrieved
- GitHub indexed references to public.organization_members in supabase/functions/atlas-creator/_shared/context.ts (active memberships, org_id/role/status) and multiple migrations.
- GitHub indexed references to public.audit_logs in supabase/migrations/20260925093000_atlas_chat_postgrest_runtime.sql (org_id,user_id,action,table_name,record_id,new_data) and other functions.
- This is NOT complete original DDL, alteration history, RLS, GRANT, constraint, or trigger provenance. Search indexing is incomplete for schema forensics. No SQL migration can safely be certified.

## RED-test audit and correction
- Spoofed provider evidence with booleans true was previously promoted to verified. Fixed by unconditional fail-closed provider status pending a trusted server adapter.
- NANP test '+1 200 024 0575' was accepted because exchange code began with 0; fixed to require area and exchange initial digits 2–9.
- Empty SMS was accepted; now rejected. The test description mentioning 'explicit absent consent' overstates coverage: no consent input or consent verification exists. It proves only empty-message rejection. Consent is still P0.

## Environment and execution
- vitest.config.ts uses jsdom and tests/setup.ts imports @testing-library/jest-dom/vitest.
- Root package.json postinstall invokes scripts/install-render-local-ai.mjs; that script can curl external model artifacts when RENDER=true. Therefore npm install is not certified side-effect free.
- No complete isolated checkout with verified dependencies, no local PostgreSQL sandbox, no Vitest/typecheck run. No runtime claims.
- GitHub CI checks for the baseline SHA returned empty status and workflow-run arrays (the workflow query covers PR-triggered runs only).
- Do not run PostgreSQL or ship until DDL and grants are reconstructed and negative transaction tests exist.

## Next gates
1. Enumerate all migration files using Git tree rather than default-branch indexed search; inspect original DDL and subsequent ALTER, triggers, policies, GRANT/REVOKE and function definitions.
2. Prove no secrets, network egress, production endpoints or postinstall effects in the isolated runner.
3. Build authenticated request context and permission evaluation server-side; do not accept client supplied context or evidence.
4. Write consent and atomic audit/investigation RLS negative tests before forward-only SQL migration.
5. Run isolated Vitest/typecheck, CI exact-SHA and E2E. P0 OPEN.
