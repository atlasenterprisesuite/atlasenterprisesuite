# ATLAS ChronoSeed 777 — Portable Capsule Codec (draft, NO-GO)
 
ChronoSeed is an offline, opt-in, single-file encrypted knowledge capsule format. This change adds a portable **format codec** and tests. It **does not** connect to ChatGPT exports, ATLAS cloud storage, Supabase, production, or the Windows remote executor.

## Canonical reuse and scope
- Continue using the existing ATLAS Local Core encrypted vault for durable *local agent memory*. ChronoSeed is a separate **user-exportable interchange format**, not another autonomous agent, orchestrator or database.
- Integrate via existing ATLAS Knowledge / Memory workflow only after privacy, approval, and provenance gates.
- Independent standalone browser prototype exists outside this PR; its UI is not deployed or embedded here.
- The v1 format is for **short notes**, not large files, photo archives, or full ChatGPT ZIP exports.

## Format and threat model
- AES-256-GCM with 96-bit random nonce and 128-bit random salt per capsule; PBKDF2-HMAC-SHA256 (310,000 iterations); AAD ATLAS-CHRONOSEED-V1.
- An internal SHA-256 digest checks the serialized note structure after authentication; an **external** SHA-256 fingerprint identifies the exact ciphertext file. The fingerprint is not a signature and proves no authorship.
- No network, implicit persistence, telemetry, cloud credentials, or automatic import.
- Maximum capsule size: 2 MiB, 200 notes. All operations fail closed on malformed data or wrong passwords.
- Web Crypto requires a supported secure context. Passwords and unencrypted notes must be handled carefully in clients; local backup remains the user's responsibility.
- No cryptographic audit; passwords can be guessed offline against exported files. Prefer long random keys. Do not use for production secrets yet.

## Local test
```sh
node --test tools/chronoseed/chronoseed-format.test.mjs
```

## Next acceptance gates (P0)
1. Full browser-to-codec and codec-to-browser **interoperability** tests, including unicode, corrupted files, wrong passphrases, and edge cases.
2. UI integration as offline, accessibility-tested responsive module behind an explicit opt-in.
3. Privacy-safe ingestion workflow (authorized export -> local parsing -> selective review -> approved Knowledge Atlas records).
4. Security review for file parsing, KDF costs, metadata disclosure, payload limits and backup/recovery.
5. Windows and Linux CI green, independent review, exact SHA, **no merge/deploy without verification**.

## Status
Prototype **in draft PR**. Tests may pass locally and in CI; production deployment and E2E remain unverified / NO-GO.
