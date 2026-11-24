# Google Workspace → accounting journal drafts

Status: implementation under review in PR #1037; not deployed or connected to a live Google account.

## Implemented flow

`/connect/google` is reachable from ATLAS Connect. It uses the current ATLAS session
and organization, starts the existing `atlas-google-connect` OAuth flow, completes
its callback through `atlas-google-workspace`, and opens Google Picker for a single
spreadsheet. Users choose a worksheet, preview transactions, select debit and
credit accounts, and explicitly import balanced **draft** journals. Negative
amounts reverse the selected accounts. Posting remains the existing accounting
workflow's separate decision.

The implementation reuses the canonical integration registry, AES-GCM credential
vault, OAuth state table, journal headers/lines, external-object links and sync-run
audit table. No new business tables or parallel accounting ledger are introduced.

## Security and import behavior

- Every operation validates the ATLAS session and `integrations.manage` in the
  requested organization. Preview/import also require `accounting.write`.
- Callback state must match the current user and organization. A conditional
  database update consumes the unexpired nonce once before exchanging the code.
- Selected-file consent does not request previously granted broad scopes.
  `drive.file` permits writes, but this integration only reads Google data.
- Refresh tokens and encrypted credentials stay server-side. Google Picker's web
  API requires an access token in the browser: only this short-lived bearer is
  returned to an authorized, origin-checked, non-cacheable Picker request. The
  client keeps it in memory, never local/session storage. This is an explicit
  exception to server-only token handling, not a claim that no token reaches JS.
- Provider URLs are fixed, redirects disabled and reads have a 15-second timeout
  and 2 MB response cap. Rate limits and provider failures do not imply success.
- Import rereads Google and checks the preview fingerprint. Unresolved issues,
  zero amounts, empty batches and changed previews block import.
- The commit RPC is executable only by `service_role`; browser callers cannot
  submit fabricated Google preview payloads. The handler supplies the user ID
  from the validated ATLAS session. SQL rechecks current RBAC for that actor.
- SQL locks the organization import stream and active connection, checks both
  active accounts belong to the organization, and atomically writes journal
  drafts, source links and audit. A conflict rolls back the whole batch.
- Idempotency is organization/file/worksheet/reference based. Exact retries skip
  existing references; changed amounts, dates, descriptions or accounts fail with
  a reference conflict. Deleted linked journals fail closed. Renaming a worksheet
  changes source identity; review references before reimporting renamed sources.
- Disconnect disables the ATLAS registry connection and deletes its encrypted
  credential. It does **not** revoke the Google-side OAuth grant or undo drafts;
  Google account settings can revoke the provider grant.

## Spreadsheet contract

Headers: `reference`, `date`, `description`, `amount`, `currency`. Required headers
may be reordered and are matched case-insensitively after trimming; headers must
be unique. The initial reader covers A:Z, up to 10,000 data rows. Larger responses
are rejected rather than partially imported. Values must be formatted strings:
ISO `YYYY-MM-DD` dates, decimal amounts without currency symbols or grouping
separators, at most two decimal places and currency `USD`. References are trimmed,
case-sensitive and at most 256 characters; descriptions at most 2,000 characters.
Numeric cells normally arrive as formatted strings through Sheets; locale-specific
formatting must be corrected in the sheet. No currencies are silently converted.

## Configuration required before live verification

The authorized operator must configure these server environment variables without
putting their values in source, PRs, logs or the browser:

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`: the exact HTTPS `/connect/google` URL registered in Google
- `GOOGLE_OAUTH_STATE_SECRET`: at least 32 characters, matching the connect function
- `ATLAS_INTEGRATION_CREDENTIAL_KEY`: 32-byte base64url AES key, matching the vault
- `GOOGLE_PICKER_API_KEY`: public browser key, restricted to Picker/Drive APIs and
  authorized app origins plus `https://docs.google.com/*`
- `GOOGLE_PICKER_APP_ID`: the Google Cloud project number for the same OAuth project
- Optional `ATLAS_ALLOWED_ORIGINS`: explicit HTTPS app origins

Enable Google Drive, Sheets and Picker APIs in that project. Deploy the existing
connect function and new workspace function using the canonical delivery process.
The additive migration `20261112004817_google_workspace_journal_import.sql` must be
reviewed against the actual existing schema, ledger triggers and permission helper
before application. It defines a server-only commit RPC, not a public write API.

## Verification and external boundary

Automated tests exercise OAuth identity/replay denial, permission denial before
provider access, changed-preview rejection, safe provider errors, handler origin
and session boundaries, the UI final action, and the SQL import on isolated
PostgreSQL through PGlite. The SQL fixture supplies minimal versions of the reused
tables and permission helper; it does not prove compatibility with every hosted
migration, RLS policy or ledger trigger. PGlite is a pinned development-only test
dependency and is not imported into the web bundle.

A live Google consent/Picker/read/import test, actual-schema migration validation,
visual desktop/mobile verification (local Chromium launch was blocked by the environment socket restriction), exact-head GitHub CI and deployment remain
release gates. This session authorizes repository changes and the PR only; no
hosted migration, merge, deployment, Google account/file access, Marketplace
publication or provider configuration has been performed.

Marketplace publication remains a separate release step: public/private visibility
must be chosen deliberately and public distribution requires Google review.

## Official references

- https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- https://developers.google.com/workspace/drive/picker/guides/web-picker-sample
- https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/get
- https://developers.google.com/workspace/marketplace/how-to-publish

## Local validation result

Final `npm test`: 541 Vitest files / 2,575 tests passed, plus 8 Node gateway tests and 13 local-core tests. Production build and explicit Edge Function typecheck passed. `verify:all` passed dependency audit (zero vulnerabilities), design, evidence, typecheck, 316 unit files / 1,571 tests, 225 integration files / 1,004 tests, local-core and Edge source checks. It then failed at `verify:python`: `test_renders_vertical_mp4_with_h264_and_aac` requires the absent `espeak` executable (`espeak_not_available`). Neural integrity and navigation checks were run separately and passed. The global gate remains failed; the unrelated native-composer code was not changed. No hosted system was modified.
