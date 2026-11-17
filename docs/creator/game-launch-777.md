# ATLAS 777 — Game Launch Editorial Planner

**Owner:** ATLAS Studio > Content Intelligence (`/studio/content`).  
**Status:** Draft PR, planning-only; P0 NO-GO for production publication, spending, external video generation, or autonomous scheduling.

## Source and objective

User-supplied eight-page `Monetiza_GTA6.pdf` and nine-page `Gana_Dinero_GTA6_YT.pdf` recommend a workflow of reference-channel analysis, 12/30 topic ideas, scripts, voice, editing, SEO and release planning. Those documents contain instructions and promotional hypotheses, **not** audited income, viral rankings, confirmed footage rights or metrics. The real Instagram Reel caption invites comments using "GTA" but its audio was unavailable. No third-party promise is treated as evidence.

Extend existing Content Intelligence and Director rather than duplicating the Creator, Video Universe, NexLev, HyperFrames or Social Publisher systems. The initial feature is an original, local, deterministic editorial starter that works without external providers or credentials and is reusable for video games beyond GTA 6.

## Scope implemented in this branch

- `packages/creator/game_launch.ts`: exactly 30 editorial hypotheses. Ideas 1–10 target the first 48 hours and 11–30 target evergreen interest. No popularity rank, views, CTR, earnings, release date, game facts or external provider state is asserted. A game name and Spanish/English language customize the seed. All concepts retain `evidenceStatus=unverified`, `performance=null` and a source-capture plan.
- `GameLaunchPlannerPanel` in existing `/studio/content` Ideas stage: choose a hypothesis and hand it to the existing local audience/hook/draft workflow. The user can then open the saved draft in Director using its existing routing, validation and permissions.
- A selected launch hypothesis uses `score=0` as **unranked**, not a measured opportunity score, and its Publisher handoff is blocked at the UI. This is defense in depth, **not** a server-side approval mechanism.
- `assessGameLaunchHandoff`: negative-first local checklist for identity, tenant, publish permission, dated sources, original footage, commercial rights, factual checks, captions, transcript, human approval and 64-hex digest. Missing or invalid evidence yields `NO_GO`; even an all-true local assertion yields only `REVIEW_REQUIRED`, never execution permission.

## Limits

No third-party connector authorization, paid credits, scraping of private accounts, recording, rendering, upload, scheduling or publishing was added. Source metadata from PDFs is not proof of output. ATLAS does not imply legal clearance by finding a clip online. Do not configure third-party connector access to always allow by default. No new tables or sensitive data stores were created. The existing tenant-scoped Content Intelligence persistence remains the source of truth when the workspace is saved.

Editorial texts and developer tests do not establish YouTube Partner Program eligibility or monetization. Game footage must follow platform, publisher and rights-holder policies, separately verified before use; no money-making guarantee is made. Prior research PRs and alternate provider plans are not production evidence.

## TDD and controls

New tests:
- `tests/unit/atlas-game-launch-planner.test.ts`: 30 prompts, window split, source/performance truthfulness, deterministic bilingual behavior, invalid input, P0 negative guards, local-all-green still non-executable.
- `tests/unit/atlas-game-launch-ui.test.ts`: reuse of existing governed route, launcher, UI truthfulness, no publisher handoff for launch hypotheses.

Run at the exact head SHA:
```bash
npm ci
npx vitest run tests/unit/atlas-game-launch-planner.test.ts tests/unit/atlas-game-launch-ui.test.ts
npm run typecheck
npm run verify:all
```

P0 controls must pass: no publishing on unknown rights, identity/tenant status, lack of evidence, failed source verification or invalid digest; no accidental authenticated third-party action. P1: improve mobile UX and ranking after real analytics connectors and legal checks are present.

**Next stage (not implemented):** integrate read-only, consent-scoped, evidence-cited YouTube research; store measurement provenance (URL, observed timestamp, comparable base); create real shot lists and audio/transcript work orders through Director; add server-side content-rights review with immutable evidence and role-based approvals; publish only with exact-SHA CI and verified production E2E. Verify rate limits, spend, rights, tenant isolation, revocation and social account permissions. Never infer that a label, assignment, generated script, screenshot or status tag proves completion.

## Acceptance / release

Draft PR and isolated branch are allowed. Merge requires unit/integration/TypeScript/build/security CI, human review, and no open P0 at exact HEAD. Deployment requires signed deployment provenance plus verified production route and end-to-end permissions at matching SHA. Until those gates pass, **NO-GO**.
