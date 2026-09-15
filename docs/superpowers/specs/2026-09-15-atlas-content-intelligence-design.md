# ATLAS Content Intelligence Design

## Status

Approved implementation design for the ATLAS Studio extension derived from the 2026-09-15 visual/product reference.

## Goal

Extend the existing ATLAS Studio Creator architecture with one governed Content Intelligence pipeline that turns creator context into audience insights, ideas, hooks, structured drafts, repurposed channel variants, quality review, production handoff and publishing handoff without creating a parallel application or fabricating provider readiness.

## Product ownership

Primary owner: **ATLAS Studio / Creator**.

Secondary integrations:

- ATLAS Identity and organization context
- Creator Library and Director
- Business Suite Social Publisher
- Approval and audit conventions already used by Creator

## User flow

`Creator Profile -> Audience -> Ideas -> Hooks -> Content Builder -> Improve -> Repurpose -> Production -> Publishing`

The flow is intentionally one workspace. The seven source capabilities are not separate tools.

## Routes and navigation

Add `/studio/content` as the Content Intelligence workspace.

ATLAS Studio home adds a `Content Intelligence` entry. The workspace exposes these stages as tabs/sections:

1. Creator Profile
2. Audience
3. Ideas
4. Hooks
5. Content Builder
6. Repurpose
7. Review

The workspace provides explicit downstream actions:

- `Open in Director` -> `/studio/create?type=video` with a governed handoff payload containing title, brief and narration seed.
- `Open in Social Publisher` -> `/business/growth/social-publisher` with a governed handoff payload containing the selected platform variant caption.

Existing routes remain compatible.

## Domain model

Add `packages/creator/content_intelligence.ts` with pure deterministic domain functions and the following public concepts:

- `CreatorProfile`
- `AudienceProfile`
- `ContentIdea`
- `HookVariant`
- `ContentDraft`
- `RepurposedVariant`
- `ContentReview`
- `ContentWorkspaceState`

The package owns deterministic transformations only. It does not claim external AI execution.

Required functions:

- `createContentWorkspaceState()`
- `generateAudienceInsights(profile, audienceSeed)`
- `generateContentIdeas(profile, audience)`
- `generateHookVariants(idea, profile)`
- `buildStructuredDraft(idea, hook, profile)`
- `repurposeDraft(draft)`
- `reviewDraft(draft)`
- `createDirectorHandoff(draft)`
- `createPublisherHandoff(variant)`

Every function must be deterministic for the same input so it is testable and safe when no AI provider is connected.

## Persistence

Add a tenant-scoped table `creator_content_workspaces`:

- `id uuid primary key`
- `organization_id uuid not null`
- `created_by uuid not null`
- `title text not null`
- `state_json jsonb not null`
- `version integer not null default 1`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Enable RLS and expose no direct browser policy. Service-role access remains behind the authenticated `atlas-creator` Edge Function.

All reads/writes must filter by `organization_id` resolved from ATLAS Identity. Save uses optimistic version matching. Audit records are written for save events.

## Creator API extension

Extend `atlas-creator` with:

- `content-workspaces` — `creator.read`
- `content-workspace` — `creator.read`
- `content-save` — `creator.write`

`content-save` overwrites organization and creator identity from the resolved server context. Client-supplied tenant identity is never trusted.

Extend `apps/web/src/lib/creatorApi.ts` with typed list/get/save functions.

## UI behavior

Create `ContentIntelligencePage.tsx` under the Creator module and a focused CSS file.

The page must:

- load existing organization workspaces;
- start a clean workspace when none is selected;
- edit Creator Profile fields for niche, objective, tone, platforms, audience and language;
- derive Audience insights from supplied context;
- generate and rank idea cards;
- create hook variants from the selected idea;
- create a structured draft with introduction, body points and CTA;
- create platform variants for Instagram/Reels, TikTok, YouTube Shorts, LinkedIn and X;
- review clarity, structure, hook strength and CTA presence;
- save the governed workspace through Creator API with optimistic version handling;
- hand off the selected draft to Director;
- hand off the selected channel variant to Social Publisher;
- show explicit loading, empty, success and error states;
- never display external AI/provider readiness unless verified by existing Creator readiness APIs.

## Director handoff

Director accepts an optional React Router location-state payload:

```ts
{
  atlasContentHandoff: {
    title: string;
    brief: string;
    narration: string;
  }
}
```

When present on first load, Director seeds only the corresponding empty draft fields. It does not overwrite an already persisted production.

## Social Publisher handoff

Social Publisher accepts optional location-state payload:

```ts
{
  atlasContentHandoff: {
    caption: string;
    platform?: PlatformId;
  }
}
```

When present, the draft caption is prefilled and platform is selected only when it matches a supported platform. Publishing remains disabled until the existing real connection/media validation gates pass.

## Security and governance

- Reuse ATLAS Identity and existing Creator permissions.
- No tenant id from the browser is authoritative.
- Reads and writes remain organization-scoped server-side.
- Save actions are audited.
- No paid provider is called by Content Intelligence.
- No provider is represented as connected unless existing verified readiness says so.
- Content generation in this slice is deterministic local transformation, not a claim of third-party AI completion.

## Responsive behavior

Desktop: stage rail + main work area + context/actions panel.

Tablet: stage rail collapses to horizontal scroll; context panel moves below content.

Mobile: single-column sections, sticky stage selector, 44px minimum touch targets, no horizontal form overflow.

## Testing

Required automated coverage:

1. Domain tests for deterministic audience, idea, hook, draft, repurpose, review and handoff output.
2. Edge contract tests proving new routes require existing Creator permissions and organization-scoped repository calls.
3. Source/UI contract tests proving `/studio/content` is routed and both handoff targets consume governed location state.
4. Existing Creator/Director/Social Publisher tests remain green.
5. Repository verification: typecheck, unit tests, integration tests and build.

## Completion criteria

Code may be merged only when:

- all new domain and route tests pass;
- existing test suites pass;
- TypeScript typecheck passes;
- production build passes;
- PR checks are green or the exact infrastructure blocker is documented;
- merge is performed from the feature branch, never by editing `main` directly.

Deployment readiness remains distinct from merge. Any Supabase migration/Edge deployment or public-site deployment that requires infrastructure mutation must be verified after merge before claiming production completion.