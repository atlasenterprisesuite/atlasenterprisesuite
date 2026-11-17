# ATLAS Reel Intelligence 777 — Authorized Instagram Intake

Status: **draft / integration pending**. This is not a production Instagram integration.

## Purpose
Reusable metadata intake for ATLAS Studio Content Intelligence, without adding a second social control plane. `packages/creator/instagram_intelligence.ts` accepts a **user-selected** Instagram following JSON and URLs explicitly shared by the user. It normalizes creator handles, deduplicates canonical Reel/post URLs, retains existing research and fails closed when documentary evidence is missing.

## Important limitations
- Instagram does **not** grant this module access to the user's recommendation feed, private subscriptions, or other accounts' protected media.
- No scraping, Instagram login impersonation, cookies, passwords, tokens or background iPhone capture.
- Importing following JSON does not discover or download each account's videos.
- A screenshot or cover is not evidence that a Reel's complete audio or video was inspected.
- `documented` means source fields were provided, **not** that ATLAS verified the source or independently viewed the Reel.

## Development gates
1. Unit tests: `tests/unit/instagram-intelligence.test.ts`
2. Connect the domain intake through existing ATLAS Studio UI and tenant-aware persistence, subject to consent.
3. Explicitly identify which Instagram platform permissions are available before adding any network provider.
4. Implement signed, audited, least-privilege intake with tenant isolation/RLS and an idempotent work queue.
5. Add authorized audio/video processing only for material lawfully available to the requesting user.
6. Require claim provenance, confidence and source verification before human-facing conclusions.
7. Run CI and production-route checks, then perform a separate documented deployment authorization/review.

**Fail closed:** no automatic media-complete or deployment-ready status without evidence.
