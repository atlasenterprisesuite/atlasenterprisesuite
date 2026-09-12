# ATLAS Creator Social Copilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a truthful, identity-gated Social Copilot to the existing ATLAS Creator Studio with weekly metric analysis, engagement drafting helpers, and provider-gated social publishing preparation.

**Architecture:** Extend the existing `/studio` route tree with `/studio/social`. Put reusable platform, metric-analysis, parser, and drafting contracts in `packages/social/src`, then keep React orchestration in `apps/web/src/modules/creator/social`. Reuse the existing `RequireAtlasIdentity` boundary and keep publishing disabled until a verified connection exists.

**Tech Stack:** React 18, React Router, TypeScript 5.7, Vitest 3, Testing Library, Vite 6, existing ATLAS Creator CSS.

**Spec:** `docs/superpowers/specs/2026-09-12-atlas-creator-social-copilot-design.md`

## Global Constraints

- Canonical repository is `atlasenterprisesuite/atlasenterprisesuite`.
- Target branch is `feat/creator-social-copilot`.
- Reuse existing Creator Studio architecture; do not create a parallel Business Suite social application.
- Never fabricate social metrics, provider readiness, messages sent, or publication state.
- No OAuth, provider tokens, auto-publishing, auto-DM, scraping, paid provider use, merge, or production deploy in this slice.
- Existing identity gates remain intact.
- Validation commands before completion: `npm run typecheck`, `npm test`, `npm run build`.

---

### Task 1: Shared social platform and analytics domain

**Files:**
- Create: `packages/social/package.json`
- Create: `packages/social/src/platforms.ts`
- Create: `packages/social/src/analytics.ts`
- Test: `tests/unit/social-platforms.test.ts`
- Test: `tests/unit/social-analytics.test.ts`

**Interfaces:**
- Produces: `PlatformId`, `SocialFormat`, `PlatformDefinition`, `socialPlatforms`, `getPlatform()`, `validateMedia()`.
- Produces: `SocialPostMetric`, `WeeklySocialAnalysis`, `parseSocialMetrics()`, `analyzeWeeklySocialMetrics()`.

- [ ] **Step 1: Write failing platform tests**

```ts
import { describe, expect, it } from 'vitest';
import { getPlatform, validateMedia } from '../../packages/social/src/platforms';

describe('social platform contracts', () => {
  it('exposes Instagram formats without claiming a live connection', () => {
    const instagram = getPlatform('instagram');
    expect(instagram.connectionStatus).toBe('not_configured');
    expect(instagram.formats.some((format) => format.aspectRatio === '9:16')).toBe(true);
  });

  it('rejects media that is incompatible with the selected format', () => {
    const format = getPlatform('tiktok').formats.find((item) => item.id === 'vertical-video')!;
    expect(validateMedia([{ type: 'image/png' }], format)).toContain('image/png is not supported for Vertical video.');
  });
});
```

- [ ] **Step 2: Write failing analytics tests**

```ts
import { describe, expect, it } from 'vitest';
import { analyzeWeeklySocialMetrics, parseSocialMetrics } from '../../packages/social/src/analytics';

describe('social analytics', () => {
  it('rejects invalid imported metrics', () => {
    const result = parseSocialMetrics('instagram,2026-09-10T14:00:00Z,reel,Hook,-1,10,2,1');
    expect(result.ok).toBe(false);
  });

  it('derives rankings from supplied metrics only', () => {
    const parsed = parseSocialMetrics([
      'instagram,2026-09-10T14:00:00Z,reel,Strong hook,1000,150,20,10',
      'instagram,2026-09-11T20:00:00Z,carousel,Other hook,1000,50,5,2'
    ].join('\n'));
    if (!parsed.ok) throw new Error(parsed.errors.join(', '));
    const analysis = analyzeWeeklySocialMetrics(parsed.posts);
    expect(analysis?.bestFormat).toBe('reel');
    expect(analysis?.worstFormat).toBe('carousel');
    expect(analysis?.bestHook).toBe('Strong hook');
    expect(analysis?.experiments).toHaveLength(3);
  });

  it('returns null for an empty week', () => {
    expect(analyzeWeeklySocialMetrics([])).toBeNull();
  });
});
```

- [ ] **Step 3: Run focused unit tests and verify failure**

Run:

```bash
npx vitest run tests/unit/social-platforms.test.ts tests/unit/social-analytics.test.ts
```

Expected: FAIL because `packages/social` contracts do not exist on `main`.

- [ ] **Step 4: Implement minimal shared package**

Create `packages/social/package.json`:

```json
{"name":"@atlas/social","private":true,"type":"module"}
```

Implement `platforms.ts` using the reconciled prior social-publisher platform definitions for Instagram, Facebook, X, LinkedIn, TikTok and YouTube. Every provider defaults to `connectionStatus: 'not_configured'`.

Implement `analytics.ts` with these exact exports:

```ts
import type { PlatformId } from './platforms';

export type SocialPostMetric = {
  id: string;
  platform: PlatformId;
  publishedAt: string;
  format: string;
  hook: string;
  reach: number;
  engagements: number;
  comments: number;
  shares: number;
};

export type WeeklySocialAnalysis = {
  postCount: number;
  bestFormat: string;
  worstFormat: string;
  bestHook: string;
  bestPostingWindow: string;
  highestPotentialChange: string;
  experiments: string[];
};

export type MetricParseResult =
  | { ok: true; posts: SocialPostMetric[] }
  | { ok: false; errors: string[] };

export function parseSocialMetrics(input: string): MetricParseResult;
export function analyzeWeeklySocialMetrics(posts: readonly SocialPostMetric[]): WeeklySocialAnalysis | null;
```

Parser rules:

- one row per post;
- eight comma-separated columns in the spec order;
- platform must exist in `socialPlatforms`;
- timestamp must parse as a valid date;
- reach/engagements/comments/shares must be finite non-negative numbers;
- generated `id` is deterministic from row index (`import-1`, `import-2`, ...).

Analysis rules follow the approved spec exactly.

- [ ] **Step 5: Run focused tests and verify pass**

```bash
npx vitest run tests/unit/social-platforms.test.ts tests/unit/social-analytics.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/social tests/unit/social-platforms.test.ts tests/unit/social-analytics.test.ts
git commit -m "feat(social): add platform and analytics contracts"
```

---

### Task 2: Engagement drafting helpers

**Files:**
- Create: `packages/social/src/drafting.ts`
- Test: `tests/unit/social-drafting.test.ts`

**Interfaces:**
- Produces: `EngagementDraftInput`, `FollowerWelcomeMessages`, `buildConversationQuestions()`, `buildFollowerWelcomeMessages()`.

- [ ] **Step 1: Write failing drafting tests**

```ts
import { describe, expect, it } from 'vitest';
import { buildConversationQuestions, buildFollowerWelcomeMessages } from '../../packages/social/src/drafting';

describe('social engagement drafting', () => {
  const input = { topic: 'AI for payroll', niche: 'small business', audience: 'operators', tone: 'professional' };

  it('creates open-ended conversation prompts', () => {
    const prompts = buildConversationQuestions(input);
    expect(prompts).toHaveLength(5);
    expect(prompts.every((prompt) => !/^do |^is |^are |^can /i.test(prompt))).toBe(true);
  });

  it('creates three differentiated follower welcomes', () => {
    expect(buildFollowerWelcomeMessages(input)).toEqual(expect.objectContaining({
      casual: expect.any(String),
      valueFirst: expect.any(String),
      questionLed: expect.any(String)
    }));
  });
});
```

- [ ] **Step 2: Run test and verify failure**

```bash
npx vitest run tests/unit/social-drafting.test.ts
```

Expected: FAIL because `drafting.ts` does not exist.

- [ ] **Step 3: Implement deterministic helpers**

```ts
export type EngagementDraftInput = {
  topic: string;
  niche: string;
  audience: string;
  tone: string;
};

export type FollowerWelcomeMessages = {
  casual: string;
  valueFirst: string;
  questionLed: string;
};

export function buildConversationQuestions(input: EngagementDraftInput): string[];
export function buildFollowerWelcomeMessages(input: EngagementDraftInput): FollowerWelcomeMessages;
```

Requirements:

- trim all inputs;
- if topic/niche/audience are blank, return `[]` for questions and empty strings for welcome variants;
- questions begin with open prompts such as `What`, `Which`, `How`, `Where`, or `Tell me`;
- no function performs a network request or send action.

- [ ] **Step 4: Run test and verify pass**

```bash
npx vitest run tests/unit/social-drafting.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/social/src/drafting.ts tests/unit/social-drafting.test.ts
git commit -m "feat(social): add engagement drafting helpers"
```

---

### Task 3: Social Copilot page, navigation and analysis/engage flows

**Files:**
- Create: `apps/web/src/modules/creator/social/SocialCopilotPage.tsx`
- Create: `apps/web/src/modules/creator/social/social-copilot.css`
- Modify: `apps/web/src/modules/creator/CreatorStudioPage.tsx`
- Modify: `apps/web/src/App.tsx`
- Test: `tests/integration/atlas-social-copilot-route.test.tsx`
- Modify: `tests/integration/atlas-creator-route.test.tsx`

**Interfaces:**
- Consumes: Task 1 `parseSocialMetrics()`, `analyzeWeeklySocialMetrics()`.
- Consumes: Task 2 drafting helpers.
- Produces: `SocialCopilotPage` React component.

- [ ] **Step 1: Write failing route and interaction tests**

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { SocialCopilotPage } from '../../apps/web/src/modules/creator/social/SocialCopilotPage';

describe('ATLAS Social Copilot', () => {
  it('renders truthful empty analytics state', () => {
    render(<MemoryRouter><SocialCopilotPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Social Copilot' })).toBeInTheDocument();
    expect(screen.getByText(/No verified or imported metrics yet/i)).toBeInTheDocument();
  });

  it('analyzes valid imported rows', () => {
    render(<MemoryRouter><SocialCopilotPage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText('Post metrics'), { target: { value: 'instagram,2026-09-10T14:00:00Z,reel,Strong hook,1000,150,20,10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Analyze metrics' }));
    expect(screen.getByText('Strong hook')).toBeInTheDocument();
    expect(screen.getByText(/1 imported post/i)).toBeInTheDocument();
  });

  it('switches to Engage and generates drafts', () => {
    render(<MemoryRouter><SocialCopilotPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole('tab', { name: 'Engage' }));
    fireEvent.change(screen.getByLabelText('Topic'), { target: { value: 'AI for payroll' } });
    fireEvent.change(screen.getByLabelText('Niche'), { target: { value: 'small business' } });
    fireEvent.change(screen.getByLabelText('Audience'), { target: { value: 'operators' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate engagement drafts' }));
    expect(screen.getByText(/Casual welcome/i)).toBeInTheDocument();
  });
});
```

Update the existing Creator route test to expect a `Social Copilot` destination on `CreatorHome`.

- [ ] **Step 2: Run focused integration tests and verify failure**

```bash
npx vitest run tests/integration/atlas-social-copilot-route.test.tsx tests/integration/atlas-creator-route.test.tsx
```

Expected: FAIL because the page and route/card do not exist.

- [ ] **Step 3: Implement `SocialCopilotPage` Analyze and Engage tabs**

Component state:

```ts
type SocialTab = 'analyze' | 'engage' | 'publish';
```

Analyze requirements:

- label textarea `Post metrics`;
- button `Analyze metrics`;
- preserve parser errors in `role="alert"`;
- preserve a provenance notice;
- render the full `WeeklySocialAnalysis` only after valid rows are supplied.

Engage requirements:

- labeled fields `Topic`, `Niche`, `Audience`, `Tone`;
- button `Generate engagement drafts`;
- render five conversation prompts plus Casual, Value-first and Question-led welcome variants;
- copy states must say these are drafts and no message was sent.

- [ ] **Step 4: Wire Creator navigation and protected route**

In `CreatorStudioPage.tsx` add:

```ts
{ kind: 'social', title: 'Social Copilot', description: 'Analyze real social metrics, draft engagement and prepare provider-gated publishing.', route: '/studio/social' }
```

Use a distinct visual class but do not change the existing media-generation contract.

In `App.tsx` import `SocialCopilotPage` and add:

```tsx
<Route path="/studio/social" element={<RequireAtlasIdentity><SocialCopilotPage /></RequireAtlasIdentity>} />
```

- [ ] **Step 5: Add responsive styles**

Create `social-copilot.css` using existing Creator variables/classes where possible. Required states:

- tab active/inactive;
- import textarea;
- error/empty/results;
- engagement output cards;
- responsive collapse below tablet width.

- [ ] **Step 6: Run focused integration tests and verify pass**

```bash
npx vitest run tests/integration/atlas-social-copilot-route.test.tsx tests/integration/atlas-creator-route.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/modules/creator/social apps/web/src/modules/creator/CreatorStudioPage.tsx apps/web/src/App.tsx tests/integration
git commit -m "feat(creator): add Social Copilot analyze and engage flows"
```

---

### Task 4: Publish preparation and final verification

**Files:**
- Modify: `apps/web/src/modules/creator/social/SocialCopilotPage.tsx`
- Modify: `apps/web/src/modules/creator/social/social-copilot.css`
- Modify: `tests/integration/atlas-social-copilot-route.test.tsx`

**Interfaces:**
- Consumes: Task 1 platform contracts and `validateMedia()`.

- [ ] **Step 1: Add failing Publish gate test**

```tsx
it('keeps publishing gated until a provider is configured', () => {
  render(<MemoryRouter><SocialCopilotPage /></MemoryRouter>);
  fireEvent.click(screen.getByRole('tab', { name: 'Publish' }));
  expect(screen.getByText(/Publishing connection required/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Publish to Instagram/i })).toBeDisabled();
});
```

- [ ] **Step 2: Run test and verify failure**

```bash
npx vitest run tests/integration/atlas-social-copilot-route.test.tsx
```

Expected: FAIL because Publish is not yet implemented.

- [ ] **Step 3: Implement Publish preparation**

Required controls:

- platform tabs/select using `socialPlatforms`;
- format select;
- caption textarea;
- file input with format-derived `accept` and `multiple`;
- media preview queue using object URLs;
- remove action revokes object URL;
- clear action revokes all object URLs;
- `validateMedia()` errors in `role="alert"`;
- publish button disabled when provider state is not `ready`, media is empty, or validation errors exist;
- connection gate text explicitly says credentials and organization authorization are not configured.

Do not add a click handler that pretends publication succeeded.

- [ ] **Step 4: Run Social Copilot tests**

```bash
npx vitest run tests/unit/social-platforms.test.ts tests/unit/social-analytics.test.ts tests/unit/social-drafting.test.ts tests/integration/atlas-social-copilot-route.test.tsx tests/integration/atlas-creator-route.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Run full repository validation**

```bash
npm run typecheck
npm test
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit final implementation**

```bash
git add apps/web/src/modules/creator/social tests/integration/atlas-social-copilot-route.test.tsx
git commit -m "feat(creator): add provider-gated social publishing"
```

- [ ] **Step 7: Open PR without merge/deploy**

Open a PR from `feat/creator-social-copilot` to `main` summarizing:

- existing Creator Studio route reuse;
- deterministic metrics analysis;
- draft-only engagement helpers;
- provider-gated publication;
- test/typecheck/build evidence;
- no secrets, OAuth, auto-send, auto-publish, merge, or deploy.
