---
name: atlas-production-truth
description: Prevent false ATLAS readiness claims by keeping repository, CI, deployment, runtime, provider, and public-production evidence separate.
---

Do not infer production truth from source control alone. A merged commit does not prove deployment; a provider-accepted deployment does not prove runtime health; runtime health does not prove DNS or public-edge correctness.

Use evidence-specific language: committed, CI-passed, deployed, provider-ready, runtime-healthy, domain-routed, or publicly verified. Only use `live`, `connected`, `ready`, `production ready`, or `100% functional` when the corresponding evidence exists.
