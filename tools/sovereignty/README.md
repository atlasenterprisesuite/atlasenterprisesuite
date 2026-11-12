# ATLAS SOV-001 — Sovereign Evidence Gate

Small, offline, zero-dependency verifier under **the existing ATLAS Manager**, not a second control plane.

- Verifies detached Ed25519 signature using a **separately pinned trusted public key**.
- Enforces exact Git commit SHA, 12 P0 statuses, SHA-256 of evidence files, 24-hour freshness and path containment.
- Always emits `eligible_for_deployment: false`; a signed claim cannot prove that a test actually ran.
- Inventories provider keyword candidates in a local checkout without displaying file content, scanning .env or following symlinks.
- No provider API calls, credentials, automatic deploy, DNS changes or background processing.

Commands:

```sh
npm run test:sovereignty
node tools/sovereignty/inventory.mjs --repo .
node tools/sovereignty/sovereign-gate.mjs --manifest /secure/release.json --signature /secure/release.sig --public-key /trusted/atlas-release.pub.pem --expected-sha "<40-char-commit-sha>" --evidence-root /secure/artifacts --output /secure/sov-001-result.json
```

The signature is over the **raw bytes** of release.json. The trust anchor must not be fetched from the same untrusted manifest. Local tests use synthetic temporary signatures, not production keys or attestations. This gate complements the existing `verify:evidence`, `verify:production:global`, Evidence Engine, Atlas Master Evidence Registry and permission/approval mechanisms. A positive gate result is not permission to merge or deploy. See the ADR and runbook.
