# ATLAS 777 — Morning Focus implementation contract

Status: PREDEPLOY / P0 OPEN. Branch based on e84d93d8e6d3a2f17da3fbbbe8c5d6ea8ee30b12.

## Reuse evidence
- apps/web/src/modules/wellbeing/FaithReflectionPage.tsx already provides prayer, action, evidence and a 21-entry local journal.
- apps/web/src/App.tsx already exposes /wellbeing/faith.
- OracleHomePage handles symbolic card readings, not reminders.
- PersonalVoicePage manages consent-governed voice profiles, not verified text-to-speech.
- AtlasVisualReference is a fixed gallery, not a general image uploader.

## Target
Morning Focus is an optional morning view of the existing faith/reflection experience, with user-authored intention "Terminar Atlas 🙏", a practical daily action, and an evidence field. Symbolic Hebrew lettering must not imply financial guarantees. Avoid automatic religious prompts for other tenants/users.

## Blocking security conditions
1. Current localStorage key atlas.faith-reflection.v1 is browser-wide, not user-scoped. Do not sync or migrate sensitive entries into a tenant database without authenticated identity, ownership authorization, RLS and revocation tests.
2. No implicit voice synthesis or notification permission.
3. No automatic claim that a task is completed: evidence must be explicitly confirmed.
4. Fail closed on missing identity for account-linked operations.
5. No writes to production Supabase, merge, deploy, or external spending.

## RED tests to implement before feature
- Distinct users sharing one browser cannot read each other's journal.
- Missing identity does not expose account-linked records.
- Revoked organization membership denies retrieval and write.
- User intention is not treated as proof of completion.
- Keyboard navigation, focus indication and accessible labels.
- Offline behavior does not silently claim server persistence.
- Date boundaries use user-local calendar day, not UTC alone.

## Next implementation
Inspect identity hooks and route guards, introduce user-scoped storage adapter with explicit anonymous/local-only mode, add failing tests, implement optional Morning Focus UI, then run typecheck, Vitest and exact-SHA CI. Keep P0 open until evidence is recorded.
