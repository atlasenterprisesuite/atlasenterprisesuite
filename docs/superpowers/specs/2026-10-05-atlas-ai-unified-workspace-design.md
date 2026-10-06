# ATLAS AI Unified Workspace — Approved Design Reference

The approved design specification is maintained in PR #639 on branch `spec/atlas-ai-unified-workspace`.

This implementation branch executes Wave 1 against that approved design. The binding principles are: reuse the existing Assistant, Work, Studio, Creator, Voice, Identity/RBAC, provider-readiness, audit and deployment architecture; use the canonical ATLAS navigation graph rather than a parallel registry; expose only real implemented Wave 1 destinations; preserve fail-closed provider and production behavior; and defer Projects, Research, Skills, Agents, Canvas, Notebooks, Pages, Apps, Scheduled, Vision and Developer until their later implementation waves.
