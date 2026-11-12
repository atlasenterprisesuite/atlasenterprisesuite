# Google Workspace import readiness

Status: draft foundation; not connected, not production-ready.

## Reused architecture

The existing `atlas-google-connect` function checks ATLAS authentication and
`integrations.manage` for the requested organization before persisting short-lived
OAuth state. This change extends its existing permission map in both server and
core helpers with `google.drive.selected`, mapped to `drive.file`. Existing
permissions retain their behavior. The Google scope permits writes to selected
files; it is not a read-only scope. This draft adds no provider write operation.

The pure core `previewGoogleSheetTransactions` helper consumes a bounded matrix
of strings, validates required columns and real ISO calendar dates, and converts
USD amounts to exact safe integer cents. It reports row-level errors and duplicate
references within the supplied batch. It does not persist, authorize, read Google
data, deduplicate against existing ledger records, or post accounting entries.

## Input contract

- At most 10,000 data rows, plus header.
- Unique, case-insensitive trimmed headers; required: `reference`, `date`,
  `description`, `amount`, `currency`. Columns can be reordered.
- Dates must be ISO `YYYY-MM-DD`; amounts must be decimal strings with at most two
  fractional digits, without currency symbols or thousands separators.
- Only `USD` is supported initially. Numeric cell values are rejected rather than
  silently rounded. Provider responses need an explicit conversion/mapping step.
- References are trimmed and compared case-sensitively. Repeated references are
  review issues, not evidence that a financial transaction is truly duplicated.
- Invalid rows do not reserve references. No automatic import on preview success.

## Remaining acceptance gates

1. Implement the callback with atomic one-time nonce consumption, binding user,
   organization and granted scopes; keep tokens in the existing approved
   server-side secret boundary. Recheck current organization authorization.
2. Configure an authorized Google Cloud OAuth client and redirect URI. No account
   access, credential changes or Google file access is authorized by this PR.
3. Integrate explicit file selection and a bounded Sheets read, including response
   mapping, provider errors, quotas, cancellation and revocation.
4. Connect preview to the existing accounting workflow with current RBAC/RLS,
   persisted idempotency and audit records. Reject imports containing unresolved
   issues; revalidate server-side at commit time.
5. Verify responsive accessible UI, tenant-negative tests, retry/concurrency,
   exact-head CI and an authorized end-to-end test before release.
6. Marketplace distribution is a separate release step. Public/private visibility
   must be chosen deliberately; public distribution requires Google review.

No migration, merge, deploy, Marketplace publication or production verification
is performed by this draft.

## Official references

- https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- https://developers.google.com/workspace/marketplace/how-to-publish
