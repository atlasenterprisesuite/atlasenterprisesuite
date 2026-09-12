---
name: atlas-testing
description: Enforce truthful ATLAS test, CI, build, route, state, and regression verification.
---

Prefer a failing test that proves the intended behavior before implementation when code behavior changes. Run the smallest relevant test first, then the broader unit/integration/typecheck/build gates required by the affected surface.

Distinguish tests that executed and failed from workflows that never received a runner, checks that were skipped, and provider verification that could not run. Never describe an unexecuted check as passed or failed software.

Do not delete or weaken assertions merely to obtain green CI. Validate empty, loading, disabled, error, success, authorization, and responsive states when applicable.
