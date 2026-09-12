# ATLAS Hospitality

ATLAS Hospitality room access is implemented on branch `feat/hospitality-room-access` and reviewed through PR #75.

Primary artifacts:

- Design: `docs/superpowers/specs/2026-09-11-atlas-hospitality-multi-provider-access-design.md`
- Implementation plan: `docs/superpowers/plans/2026-09-11-atlas-hospitality-multi-provider-access.md`
- Readiness gates: `docs/hospitality/ROOM_ACCESS_READINESS.md`
- Domain: `packages/hospitality/`
- Backend: `supabase/functions/atlas-hospitality-access/`
- Migration: `supabase/migrations/20260911_hospitality_room_access.sql`
- Web workspace: `apps/web/src/modules/hospitality/`
- Browser API: `apps/web/src/lib/hospitalityApi.ts`
- Verification: Hospitality unit/integration/security tests plus `.github/workflows/hospitality-self-hosted-ci.yml`

Do not mark a real hotel provider instance `ready` or deploy this branch until the verification and provider-specific gates in `ROOM_ACCESS_READINESS.md` are satisfied.
