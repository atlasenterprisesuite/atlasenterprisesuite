# ATLAS Client Vault — Security Gate (777 REVIEW)

Status: DESIGN / NOT DEPLOYED. No client documents have been imported.

## Non-negotiable requirements
- Never import client tax documents, password spreadsheets or PII into GitHub, CI logs, telemetry, AI prompts, or public buckets.
- Require documented authorization and purpose before processing third-party client records.
- Use private storage, per-tenant ownership and per-client authorization checked server-side. Deny by default; reject missing tenant, user, or permission.
- Enforce MFA with recent step-up for export, delete, access grants and recovery.
- Encrypt in transit and at rest; manage encryption keys outside the application database, with rotation and access audit.
- Upload only by short-lived, scoped server-issued URLs; validate content type, size, malware scan and SHA-256 before marking available.
- Store source Drive file ID, immutable object version ID, SHA-256, tenant ID, client ID, uploader and timestamp in append-only evidence records.
- Never overwrite originals; quarantine suspect files. Separate credential documents into a secrets vault, not ordinary client documents.
- Require two-person approval and retention/legal-hold checks for destructive operations; keep immutable backups in separate failure domains and regularly test restoration.
- Disable public sharing and deny cross-tenant reads, writes, listing, downloads and signed URLs.
- Redact PII from logs and error messages; audit all access attempts and permission changes.

## Acceptance tests (P0 fail closed)
1. Anonymous, revoked, wrong-tenant and wrong-client users cannot list, download, or issue signed URLs.
2. An authorized user cannot escalate permissions by changing client or tenant IDs.
3. MFA absent or stale denies export, delete and permission changes.
4. Uploaded bytes match SHA-256; corruption or malware blocks availability.
5. Deletion cannot bypass legal hold, retention or dual approval.
6. A restore drill proves a byte-identical backup in a separate failure domain.
7. Production E2E evidence identifies deployed commit SHA, verified routes, RLS policies, storage policies and audit entries.

## Source inventory observed 2026-10-15
Google Drive source folder: 1B9NWhECQLRfNg_4sx01eFNqNfQVfRGWQ.
15 immediate entries: 12 folders and 3 files, including a spreadsheet named Table Passwords.xlsx. This is an inventory only, not a verified complete recursive count.
Source originals remain in Google Drive; never delete or change their sharing without an explicit reviewed migration.

## Release policy
P0 blocked until schema review, threat model, RLS tests, isolated storage, backup/restore evidence and production verification. No automatic deployment of customer data workflows from this document.
