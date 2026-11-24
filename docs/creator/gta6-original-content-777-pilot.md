# ATLAS Creator — GTA VI original-content pilot (777 REVIEW)

Status: **PROPOSAL / NOT DEPLOYED**. Source: 81.8-second user-supplied video reviewed 2026-11-18. Visual-only examination; spoken audio not independently transcribed.

## Claim vs evidence
The reel shows Claude drafting a GTA VI narrative, a YouTube search/channel dashboard and €200/€1,500/€6,000 captions. It provides no independently auditable attribution of those amounts to this workflow. Do not claim revenue or predict returns. Avoid copying the script, clips, thumbnails, or creator identity.

## Reuse existing ATLAS foundation
- `packages/creator/content_intelligence.ts`
- `apps/web/src/modules/creator/content/ContentIntelligencePage.tsx`
- `packages/social/src/platforms.ts`
- `tests/unit/atlas-content-intelligence.test.ts`

Implement within existing Creator/Social modules, not a parallel platform. Start by inspecting current contracts, schema, test fixtures, and connected authorization model.

## Pilot output (original)
Topic: **GTA VI: five things to verify before believing a viral claim**.
Original short (45–60 seconds) concept:
1. Hook (0–5s): "Viste un video asegurando que GTA VI hará millonario a cualquiera. ¿Qué se puede demostrar?"
2. Source test (5–20s): distinguish publisher announcement, verified reporting, and speculation; display each source's date.
3. Rights test (20–35s): distinguish original commentary from unauthorized reused gameplay/music/trailers.
4. Reality check (35–50s): views, monetization eligibility, and creator revenue are different metrics; no guaranteed payouts.
5. CTA (50–60s): invite viewers to ask for fact-checking of specific claims.

Bilingual metadata proposal:
- ES title: "GTA VI: 5 verificaciones antes de creer un video viral"
- EN title: "GTA VI: 5 checks before trusting a viral video"
- ES description: "Análisis original de afirmaciones sobre GTA VI. Separamos anuncios oficiales, hipótesis y datos comprobables. Sin promesas de ingresos."
- EN description: "Original analysis of GTA VI claims. We separate official announcements, speculation and verified data. No earnings promises."
- Do not use Rockstar/YouTube branding in a way implying affiliation.

## Technical workflow (fail closed)
`idea -> source ledger -> original script -> rights manifest -> assets -> narration/captions -> render -> automated QA -> human editorial review -> channel OAuth authorization -> private upload -> policy and playback verification -> authorized publication -> analytics`.

Per asset ledger: SHA-256, source URL, copyright owner/license, attribution, allowed territories/platforms, expiration, creator consent, AI disclosure determination, provenance. Reject unknown rights. Retain script versions and corrections.

P0: no commercial use of third-party gameplay, trailers, music, thumbnails without corresponding rights; no unauthorized account access; no fabricated quotes/sources or revenue; no public upload without explicit authorized channel scope; fail closed if missing authorization, rights, privacy validation, or approved source ledger.

P1: low-quality subtitles, unclear thumbnail, weak retention, translation errors; document improvements before next cycle.

## TDD acceptance tests (not yet executed)
1. Missing/expired license -> render/publication blocked.
2. Source without date/URL -> factual claim withheld.
3. Missing or revoked OAuth scope -> upload blocked.
4. Wrong tenant/channel -> upload blocked and audited.
5. Repeated job idempotency key -> single upload attempt.
6. Realistic synthetic material requiring disclosure -> flagged before upload.
7. Published artifact SHA matches reviewed artifact SHA.
8. Private pilot verified via channel API before public visibility.
9. Performance shows actual impressions, CTR, retention, revenue only when available and attributed; no placeholders represented as earnings.
10. CI, PR review, production E2E and exact deployed SHA required before DONE.

## Next engineering change
Extend the existing Content Intelligence workflow with a source/rights ledger and review gates; wire adapter to existing Social platform with minimal scopes. Add tests first and ship via PR->CI->review->merge->deploy->E2E only after checks pass. This document is not evidence that any of those capabilities were implemented.

## Applicable official policies
- https://support.google.com/youtube/answer/1311392
- https://support.google.com/youtube/answer/138161
- https://support.google.com/youtube/answer/14328491
