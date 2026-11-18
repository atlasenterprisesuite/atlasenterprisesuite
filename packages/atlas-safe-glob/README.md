# ATLAS Safe Glob — bounded original matcher (research only)

Original clean-room, dependency-free JavaScript matcher. It deliberately supports a **restricted subset** of glob patterns: literal Unicode code points, escaped literals, `?` (one non-slash code point), `*` (zero or more non-slash code points), and `**` (zero or more code points, potentially across slashes). Matching is case-sensitive. Its `**/` semantics are intentionally not the same as picomatch (the slash remains required). The parser refuses braces, character classes, extglobs, alternation, negation and trailing escapes instead of guessing what they mean.

Its matcher uses dynamic programming, **never compiles user-controlled regular expressions**, and enforces maximum pattern/input lengths and a maximum work-cell budget of 131,072. Throwing on unsupported syntax or oversized requests is intentional fail-closed behavior. This is a first implementation, not a general-purpose glob package.

## Run

```sh
node --test packages/atlas-safe-glob/safe-glob.test.mjs
```

Import from `packages/atlas-safe-glob/safe-glob.mjs` and invoke `atlasGlobMatch(pattern, candidate)`. No external packages are required.

## Trust and release boundary

**Do not alias this module as `picomatch` in npm overrides, Vite, Vitest or tinyglobby.** This is not feature-equivalent to picomatch and replacing it there without exhaustive compatibility tests may break builds. It is not a patch of CVE-2026-112366 and **does not make npm audit pass** while `picomatch@4.0.7` is still in `package-lock.json`.

The security P0 blocker remains issue #1065. PR #1072's 6G research simulation must not be released based on this module's focused tests. Before production adoption, require a concrete ATLAS call-site with allowed glob subset, integration and authorization tests, and required full repository audit/CI at the exact SHA.
