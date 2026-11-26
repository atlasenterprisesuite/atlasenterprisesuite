# ATLAS Context Guard — 777 REVIEW

Offline defensive reference implementation. Reuses the existing Sentinel unit test discovery in CI; no new workflow, dependencies, model calls or provider spend.

The policy accepts independently verified server-side metadata only. A caller must resolve the authenticated actor, record ownership, source classification and provenance independently; never trust those fields from a model or user payload. Accepted context is data only, not instructions or authorization. The audit helper emits fixed decision codes without record contents or tenant identifiers.

Run `python3 -m unittest discover -s tools/atlas-sentinel-shield -p 'test_*.py'`.

This is not a runtime integration, prompt injection detector, authentication mechanism, RLS replacement or production security claim. Runtime integration must reuse the existing Copilot gateways and authorization checks, enforce rejection before dispatch, preserve tenant RLS, and be verified with synthetic integration tests. No deployment before required CI, independent review and exact-SHA E2E verification.
