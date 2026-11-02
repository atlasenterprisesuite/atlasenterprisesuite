# NEG-RULESET-001 — isolated certification contract

Target: ATLAS-777-MAIN-P0-PROTECTION on main.
Base SHA: bbd9dafd469c51ed226f3451fd50f66c1d7e8579 (PR #975).

This branch intentionally carries **no failing workflow**. It exists to stage a safe negative certification without changing main, its rulesets, or PR #975.

## Acceptance
1. Verify required council-security is emitted for an isolated PR targeting main.
2. Run a reversible, PR-local failure (never weaken the ruleset or change main).
3. Capture the failing check run, exact head SHA, and GitHub's effective merge-block evidence. A draft PR alone does not prove this: distinguish draft blocking from a failed required check.
4. Restore the passing job on a new SHA; confirm all required checks succeed and negative test evidence remains archived.
5. Do not merge, deploy, or disable protections.

Status: STAGED ONLY — negative rejection NOT yet certified.
