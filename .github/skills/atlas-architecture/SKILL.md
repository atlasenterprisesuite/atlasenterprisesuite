---
name: atlas-architecture
description: Preserve canonical ATLAS ownership, shared architecture, and anti-duplication rules while implementing changes.
---

Resolve the owning ATLAS module before creating routes, packages, services, schemas, or integrations. Search the current repository first and reuse shared shell, auth, tenancy, RBAC, audit, navigation, provider adapters, and data contracts.

Do not create a parallel source of truth for an existing subsystem. If an approved implementation or active integration branch already owns the capability, extend or consume that work rather than duplicating it.

Keep module boundaries explicit and make cross-module dependencies flow through defined interfaces.
