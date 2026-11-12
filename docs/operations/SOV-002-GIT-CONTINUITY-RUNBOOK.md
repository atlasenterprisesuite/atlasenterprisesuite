# SOV-002 — Git continuity runbook

**Purpose:** offline committed-source recovery. Not database recovery or production certification.

**Prerequisites:** trusted fully fetched clean main checkout; Git and Node.js 22+ installed; a trusted exact 40-character commit SHA independent of the backup; an encryption-protected offline destination.

## Export committed main

    node tools/sovereignty/git-continuity.mjs export --repo /opt/atlas/checkout --bundle /secure/atlas-main.bundle --expected-sha <40-char-sha>

Export generates two files: the Git bundle and a .json SHA-256 sidecar. Neither overwrites an existing path. A read-only self-containment check runs against a new empty bare repository.

## Verify without a remote

    node tools/sovereignty/git-continuity.mjs verify --bundle /secure/atlas-main.bundle --manifest /secure/atlas-main.bundle.json --expected-sha <40-char-sha>

Verification compares SHA-256 and branch HEAD, checks Git object prerequisites in an empty bare repository, and does not reach GitHub or any provider. The sidecar is NOT signer-authenticated; use an independently pinned release signature for adversarial integrity.

## Restore committed source into a NEW directory

    node tools/sovereignty/git-continuity.mjs restore --bundle /secure/atlas-main.bundle --manifest /secure/atlas-main.bundle.json --expected-sha <40-char-sha> --destination /secure/atlas-recovered

The command refuses a destination that already exists. It verifies restored HEAD and does not run application scripts. A failed clone may leave partial files for investigation.

## Test

    npm run test:sovereignty

Ten new SOV-002 synthetic tests cover export, verification, real offline Git clone, mismatched SHA, dirty tree, tampering, overwrite prevention and restore safeguards. They run via the existing SOV-001 test glob; no parallel CI or control plane is introduced.

## P0 unverified boundaries

Git LFS objects and submodules require separate backup; so do npm registry packages, operating system dependencies, infrastructure configuration, databases, object storage, DNS, key vaults, credentials, tenant isolation, authorization and runtime health. None of these are certified by this module. Never label a restored source tree as a recovered live service.
