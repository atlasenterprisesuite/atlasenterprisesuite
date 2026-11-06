# Local Core continuity journal — experimental foundation

Extends the existing encrypted Local Core vault with atomic read/modify/write and a
versioned offline operation journal. No external dependencies or network access.

`createContinuity({ directory, passphrase, tenant })` exposes `edit(record, value)`,
`read(record)`, `status()`, `receive(operation)`, and `flush(send)`.

- An edit stores its version, parent version, and pending operation atomically inside
  the existing AES-GCM vault. Reopening preserves pending work.
- Delivery retries reuse the same operation ID and digest. An adapter must acknowledge
  the exact tenant, ID, and digest only after durable authorized server acceptance.
- Replay is idempotent. Concurrent versions are retained as conflicts; outgoing delivery
  is blocked while conflicts remain. There is no conflict-resolution UI yet.
- History and pending work share the vault entry's 64 KiB bound. Reaching the bound
  rejects the complete mutation without deleting earlier work. No automatic pruning.
- Values are limited to 8 KiB; this is a notes foundation, not file synchronization.

## Trust boundary and remaining work

Tenant binding prevents accidental reuse of one journal across tenants; it is NOT
server RBAC/RLS or proof of identity. `receive()` requires a future adapter to authenticate
and authorize incoming operations before calling it. SHA-256 is corruption detection,
not authentication. There is no listening endpoint or automatic cloud fallback.

This library is not yet installed by the existing device installers, wired into the web
UI, or connected to Supabase. Browser/iOS storage, authenticated enrollment and transport,
revocation, server idempotency, conflict resolution, schema migrations, safe compaction,
independent encrypted backups and tested restoration remain open acceptance gates.
A version journal in the same vault is not a disaster-recovery backup.

Do not claim automatic device synchronization, end-to-end encryption across devices,
remote control, or production readiness from these tests. Tests use temporary local
vaults and injected transports; no real phones or remote servers participate.

Validation: `npm run test:local-core` (19 tests at implementation time). Initial red
run failed with ERR_MODULE_NOT_FOUND before implementation. Full application checks and
exact-SHA CI are separate gates.
