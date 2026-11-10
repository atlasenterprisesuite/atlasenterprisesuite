# ATLAS Civilian Sentinel — restricted simulation rollout

Status: proposed; NEVER infer a deployed emergency-alert service.

Scope: authenticated, tenant-contained educational emergency simulations. No weapons, electronic interference, autonomous targeting, real threat classification, emergency dispatch, public push notifications, or external actions.

API: `atlas-civilian-sentinel` GET with user JWT; RLS restricts rows to owner and membership. No write API exposed in the function. Failure is non-disclosing (503 or 401). Production deployment requires migration, authenticated isolation tests, review, and Cloudflare exact-SHA E2E evidence.

Worker: `GET /api/v1/civilian-sentinel/status` provides a publicly readable **disabled/experimental** capability declaration, never a real-time warning.

Acceptance P0: verify anonymous cannot read simulation data; cross-org access denied; no external notifications; no leaked credentials; edge and worker deployed at reviewed SHA; CI green; rollback tested. P1: accessibility UX and localized drills before pilot.

Compatibility: the existing `tools/atlas-sentinel-shield` scanner is unrelated and unchanged.
