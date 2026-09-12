# ATLAS Creator Social Copilot — Design Specification

Date: 2026-09-12
Status: Approved for implementation
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Target branch: `feat/creator-social-copilot`
Owner module: ATLAS Studio / Creator
Primary route: `/studio/social`

## 1. Purpose

ATLAS Creator Social Copilot turns the social-media prompt patterns captured in the approved visual reference into real, governed Creator Studio capabilities instead of a static prompt library.

The first slice provides three connected surfaces inside ATLAS Studio:

1. **Analyze** — ingest verified or explicitly imported post metrics and produce deterministic weekly findings such as best/worst format, strongest hook, strongest posting window and the highest-potential experiment.
2. **Engage** — generate open-ended comment prompts and new-follower welcome-message variants from a user-provided topic, niche and audience context without automatically sending messages.
3. **Publish** — prepare social posts against provider-specific media constraints while truthfully blocking publication until an authorized platform connection exists.

The feature must preserve ATLAS identity, organization boundaries, permission checks, truthful provider state, auditability and the repository rule that no metric or connected state may be fabricated.

## 2. Existing ATLAS Context

ATLAS already has:

- a canonical Creator Studio under `apps/web/src/modules/creator`;
- identity-gated routes under `/studio`;
- `CreatorHome`, `CreatorWorkspace`, `CreatorLibrary`, and `CreatorProviders`;
- a central `atlas-copilot` Supabase function with organization/user context and `intelligence.use` permission checks;
- a stale `feature/business-social-publisher` branch containing useful social platform format contracts and a draft-only publisher, but that branch is materially behind `main` and must not be merged wholesale.

The new feature extends the existing Creator module. It must not create a parallel Business Suite social application or a second social source of truth.

## 3. Route and Information Architecture

Primary navigation:

`ATLAS Studio -> Social Copilot`

Primary route:

- `/studio/social`

The page contains three tabs:

- `Analyze`
- `Engage`
- `Publish`

The Creator Studio home adds a Social Copilot card. Existing Studio routes remain unchanged.

## 4. Data Boundaries

### 4.1 Social metrics

ATLAS accepts metrics only from:

- an authorized provider connection when one exists; or
- an explicit user import in the current session.

If no verified/imported metrics are present, the Analyze view renders an empty/configuration state. It must never show sample reach, engagement, follower or timing metrics as though they were production data.

### 4.2 Provider connection state

Platform connection states are explicit:

- `not_configured`
- `ready`
- `unavailable`

The first implementation defaults known providers to `not_configured` because no authorized provider secret or verified connection is present in the repository.

### 4.3 AI generation

AI-assisted copy may use the existing `atlas-copilot` gateway in a later connected slice. The first implementation must remain useful without provider calls by supplying deterministic structured drafting helpers from user input. It must not claim a remote AI response unless one was actually returned by the gateway.

## 5. Shared Social Domain Package

Create `packages/social/src` as the reusable source of social contracts.

### 5.1 Platform contracts

`PlatformId` values:

- `instagram`
- `facebook`
- `x`
- `linkedin`
- `tiktok`
- `youtube`

Each platform exposes:

- display name;
- connection status;
- supported formats;
- aspect ratio;
- pixel dimensions;
- supported media kinds;
- max file count.

The format table may reuse the previously authored stale-branch contract after reconciling it with `main`.

### 5.2 Metric model

`SocialPostMetric` fields:

- `id: string`
- `platform: PlatformId`
- `publishedAt: string`
- `format: string`
- `hook: string`
- `reach: number`
- `engagements: number`
- `comments: number`
- `shares: number`

All numeric values must be finite and non-negative.

### 5.3 Weekly analysis result

`WeeklySocialAnalysis` fields:

- `postCount`
- `bestFormat`
- `worstFormat`
- `bestHook`
- `bestPostingWindow`
- `highestPotentialChange`
- `experiments: string[]`

Analysis is deterministic and transparent. Rankings must be derived from supplied metrics, not generated from invented values.

Engagement rate is computed as:

`engagements / reach` when reach is greater than zero, otherwise `0`.

Format comparisons aggregate mean engagement rate across posts of the same format.

The strongest hook is the hook from the post with the highest engagement rate, with reach as the stable tie breaker.

Posting windows are grouped by UTC hour into:

- `00:00–05:59`
- `06:00–11:59`
- `12:00–17:59`
- `18:00–23:59`

The winning window is the group with the highest mean engagement rate.

### 5.4 Engagement copy helpers

Expose pure functions:

- `buildConversationQuestions(input)`
- `buildFollowerWelcomeMessages(input)`

`buildConversationQuestions` returns open-ended prompts and avoids yes/no framing.

`buildFollowerWelcomeMessages` returns three clearly differentiated variants:

- casual;
- value-first;
- question-led.

These are draft helpers only and never send messages.

## 6. Analyze UX

The Analyze tab provides a textarea for explicit metric import using CSV-like rows with the columns:

`platform,publishedAt,format,hook,reach,engagements,comments,shares`

A parser validates each row. Invalid imports show actionable errors and do not enter analysis state.

When valid rows exist, ATLAS shows:

- imported post count;
- best format;
- worst format;
- best hook;
- best posting window;
- highest-potential change;
- three experiments for the next week.

A visible provenance notice states that findings are based only on imported session data until a verified platform integration exists.

## 7. Engage UX

The Engage tab provides fields for:

- topic;
- niche;
- audience;
- tone.

The user can generate:

- conversation questions;
- follower welcome messages.

The output remains editable/copyable draft text. No send action is presented until a real messaging provider connection exists.

## 8. Publish UX

The Publish tab reuses the reconciled platform-format contract from the prior Social Publisher work.

The user can:

- choose a platform;
- choose a supported format;
- write a caption;
- upload compatible image/video files;
- see file validation errors;
- preview the first compatible media item;
- clear the draft.

The publish button is disabled while the provider state is `not_configured` or when validation fails.

The UI explicitly says publication requires an authorized organization connection.

## 9. Permissions and Security

The feature is protected by the existing `RequireAtlasIdentity` route gate.

Future backend actions use these permission names:

- `social.read`
- `social.analyze`
- `social.compose`
- `social.publish`
- `social.send`

The first front-end slice must not weaken or bypass `intelligence.use` or any existing identity gate.

Provider secrets remain server-side and are not introduced by this work.

## 10. Styling and Responsive Behavior

Social Copilot must reuse ATLAS Creator styling conventions and remain usable on:

- desktop;
- tablet;
- mobile.

Tabs must expose active state and remain keyboard-operable.

Forms must expose labels and status/error messages through semantic HTML and ARIA where appropriate.

## 11. Testing

Unit tests cover:

- social platform lookup;
- media validation;
- metric parser validation;
- weekly analysis ranking;
- empty analysis behavior;
- conversation-question generation;
- follower welcome-message variants.

Integration tests cover:

- `/studio/social` content rendering;
- tab switching;
- empty Analyze state;
- valid imported metrics producing findings;
- Publish connection gate.

The final branch must pass:

- `npm run typecheck`
- `npm test`
- `npm run build`

## 12. Non-Goals

This slice does not:

- connect OAuth accounts;
- store provider access tokens;
- auto-publish to any social network;
- auto-send follower messages or DMs;
- fabricate analytics data;
- scrape social networks;
- spend provider credits;
- merge or deploy to production without explicit approval.

## 13. Definition of Done

The slice is complete when:

- `/studio/social` is reachable from the existing Creator Studio;
- Analyze works with validated real/imported session metrics only;
- Engage produces useful deterministic drafts without pretending they were remotely generated;
- Publish validates media truthfully and remains gated while providers are unconfigured;
- identity gating remains in place;
- tests cover the core flows;
- typecheck, tests and build pass;
- the work is committed to `feat/creator-social-copilot` and presented as a PR to `main`, without merge or deploy.
