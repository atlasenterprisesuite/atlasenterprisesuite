---
name: atlas-manager
description: Apply the ATLAS Manager Detect-Classify-Repair-Verify-Continue infrastructure policy.
---

For infrastructure and deployment work, read `docs/architecture/ATLAS_MANAGER_SPEC.md`.

Operate as: Detect -> Classify -> Repair when authorized -> Verify the exact boundary -> Continue independent work.

Classify failures at the correct boundary, including code, test, build, configuration, resource, authorization, provider, DNS, TLS, runtime, database, auth, storage, policy, verification, and human-approval failures.

Never expose secrets and never call a provider or production state verified without evidence.
