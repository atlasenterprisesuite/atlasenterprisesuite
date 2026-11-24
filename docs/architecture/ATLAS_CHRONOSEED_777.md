# ATLAS ChronoSeed 777 — Offline capsules and Knowledge Atlas draft staging (NO-GO)

ChronoSeed is an offline, opt-in, single-file encrypted knowledge capsule format. This draft PR adds a portable format codec, format-level bidirectional interoperability tests, and a **read-only local preparation** step for selective Knowledge Atlas drafts. No customer data, credentials or personal conversations are ingested here.

## Canonical reuse
- Reuse ATLAS Local Core encrypted vault for durable **local agent memory**. ChronoSeed is a separate **user-exportable interchange format**, not another agent, database or orchestrator.
- Reuse existing Knowledge Atlas `atlas-memory` API for later authenticated writes and approval. No new database, organization policy or production backend.
- The independent single-file browser demo is **not** deployed or included in this PR. Format tests use matching wire rules but **are not an actual browser UI E2E**.
- v1 is for **short notes**; not a file-storage service, photo archive, or ChatGPT ZIP scraper.

## Format and security constraints
- AES-256-GCM with random 12-byte nonce and 16-byte salt per capsule; PBKDF2-HMAC-SHA256 (310,000 iterations); authenticated associated data `ATLAS-CHRONOSEED-V1`.
- The inner SHA-256 digest validates serialized note structure **after** AEAD authentication. An external SHA-256 identifies the exact ciphertext file. Neither digest proves authorship or provenance.
- Maximum capsule file: 2 MiB; maximum records: 200, plaintext size limited. Wrong passphrase and malformed content fail closed.
- `createdAt` (unencrypted envelope metadata) and file size are visible to anyone with the capsule. No cryptographic audit. Long random keys recommended; **not for production secrets**.
- Web Crypto requires a supported secure context. The module does not transmit or persist data.

## Knowledge Atlas staging
`tools/chronoseed/knowledge-atlas-drafts.mjs` exports `prepareKnowledgeAtlasDrafts`.

- Requires **explicit reviewed=true** and **specific selectedIndices** (no all-by-default). Up to 50 selected notes per batch, matching the existing `atlas-memory?api=import` cap.
- Produces `{approve:false,records:[...]}` with source provenance, `kind:note`, `sensitivity:restricted`, and `review_required` tags.
- Does **not** call `fetch`, create or approve memory records, use authorization tokens, or upload personal material.
- Uses `source_ref` built from the ciphertext file SHA-256 and selected entry index. It **does not** publish a stable plaintext fingerprint, reducing unnecessary disclosure.
- `reviewed=true` is only a staging input, **not identity, authorization or proof of consent**. Any eventual upload must use the existing authenticated API and per-record review before approval. UI and user authorization are **P0 gates**.
- A classified `chat_import` source is supported only by explicit caller selection; chat histories never enter automatically.

## Tests
```sh
node --test tools/chronoseed/chronoseed-format.test.mjs tools/chronoseed/chronoseed-browser-interop.test.mjs tools/chronoseed/knowledge-atlas-drafts.test.mjs
```
Checks 12 scenarios on Node 22. CI runs the three suites on Ubuntu and Windows.

## Next P0 gates
1. Embed/integrate actual browser UI only with clear opt-in and **real Chromium/WebKit UI E2E** (this environment blocked navigation, so not yet verified).
2. Validate exact-browser file roundtrips with DOM interactions (file download -> decrypt and cross-import), Unicode, corruption and a11y.
3. Add authenticated Knowledge Atlas **draft-only** user flow with review and provenance; never auto-approve or upload private chats without authorization.
4. Security review for metadata disclosure, password KDF strength, input validation, client memory and backups.
5. Complete CI, independent review, SHA-exact verification and production checks; **P0 fail-closed, no merge/deploy until evidence**.

## Current status
**Draft PR / P0 NO-GO**. Local codec and stage tests pass, but full E2E, security review and production deployment are not verified.
