# ATLAS Private Oracle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a private, owner-only ATLAS Assistant oracle experience at `/assistant/oracle` using the verified Mensajes del Oráculo Místico cards, persistent owner-scoped readings, strict RLS, and a future-safe entitlement model.

**Architecture:** Keep the oracle as a bounded ATLAS Assistant capability, not a Health feature. Domain rules live in a small `packages/oracle` package, persistence and authorization live in Supabase with owner-only RLS, the web client uses the existing ATLAS session/fetch layer, and explicit Assistant oracle intents delegate to the same oracle reading service instead of duplicating draw logic.

**Tech Stack:** React 18.3.1, TypeScript 5.7.x, React Router, Vite 6.4.3, Vitest 3.2.6, Supabase Postgres/RLS/Edge Functions, existing ATLAS Identity and `authorizedAtlasFetch` session layer.

**Spec:** `docs/superpowers/specs/2026-09-14-atlas-private-oracle-design.md`

## Global Constraints

- Phase 1 is private to the current entitled owner only.
- Canonical route is `/assistant/oracle`.
- Do not hardcode a user UUID in application code or UI.
- Do not expose Oracle in general enterprise navigation in Phase 1.
- Tenant/admin status alone must never grant access to another user's private readings.
- Seed only verified cards. Do not invent the missing cards from the 44-card deck.
- Known verified cards are: CONFÍA, ESCUCHA, ACEPTA, LUZ INTERIOR, INTUICIÓN, GUÍA DIVINA, PAZ DEL ALMA.
- Readings are symbolic/reflection-oriented and must not claim objective prediction, supernatural certainty, medical diagnosis, investment advice, or legal advice.
- Audit and telemetry must not copy full private interpretation prose by default.
- No merge to `main` or production deploy before tests, typecheck, build, PR review, and release verification pass.

---

## File Map

- `packages/oracle/src/types.ts` — domain types and spread definitions.
- `packages/oracle/src/cards.ts` — verified card catalog only.
- `packages/oracle/src/draw.ts` — deterministic card selection from a persisted reading seed.
- `packages/oracle/src/interpretation.ts` — structured reflection copy built from verified meanings and spread positions.
- `packages/oracle/src/index.ts` — package exports.
- `supabase/migrations/20260914_private_oracle.sql` — entitlement, deck/card catalog, readings, reading cards, notes, favorites, RLS, initial owner entitlement snapshot, audit-safe functions.
- `supabase/functions/atlas-oracle/index.ts` — authenticated application service for entitlement, create/read/list/note/favorite operations.
- `apps/web/src/lib/oracleApi.ts` — browser API client over existing `authorizedAtlasFetch`.
- `apps/web/src/modules/oracle/RequireOracleEntitlement.tsx` — client gate that never substitutes for server/RLS authorization.
- `apps/web/src/modules/oracle/OracleRoutes.tsx` — Oracle nested routes.
- `apps/web/src/modules/oracle/OracleHomePage.tsx` — daily/focused/full reading launch surface and recent history.
- `apps/web/src/modules/oracle/OracleReadingPage.tsx` — persisted reading detail and private note/favorite controls.
- `apps/web/src/modules/oracle/OracleDeckPage.tsx` — truthful verified-card browser with deck completeness state.
- `apps/web/src/modules/oracle/oracle.css` — responsive violet/indigo/gold styling and reduced-motion behavior.
- `apps/web/src/App.tsx` — route registration only; no global nav item.
- `supabase/functions/atlas-copilot/index.ts` — explicit oracle intent handoff to `atlas-oracle` while preserving normal copilot behavior.
- Tests under `tests/unit` and `tests/integration`.

---

### Task 1: Oracle domain package and deterministic draw

**Files:**
- Create: `packages/oracle/src/types.ts`
- Create: `packages/oracle/src/cards.ts`
- Create: `packages/oracle/src/draw.ts`
- Create: `packages/oracle/src/interpretation.ts`
- Create: `packages/oracle/src/index.ts`
- Test: `tests/unit/oracle-domain.test.ts`

**Interfaces:**
- Produces `OracleCard`, `OracleReadingType`, `OracleSpreadPosition`, `ORACLE_CARDS`, `spreadForReadingType(type)`, `drawCards(cards, count, seed)`, and `buildOracleInterpretation(...)`.
- Later tasks consume these exact exports from `packages/oracle/src/index.ts`.

- [ ] **Step 1: Write failing domain tests**

```ts
import { describe, expect, it } from 'vitest';
import { ORACLE_CARDS, drawCards, spreadForReadingType } from '../../packages/oracle/src';

describe('oracle domain', () => {
  it('ships only the seven verified cards', () => {
    expect(ORACLE_CARDS.map((card) => card.title)).toEqual([
      'CONFÍA', 'ESCUCHA', 'ACEPTA', 'LUZ INTERIOR', 'INTUICIÓN', 'GUÍA DIVINA', 'PAZ DEL ALMA'
    ]);
  });

  it('uses the defined seven-position full spread', () => {
    expect(spreadForReadingType('full').map((position) => position.key)).toEqual([
      'general', 'love', 'money', 'work', 'challenge', 'advice', 'closing'
    ]);
  });

  it('returns the same card order for the same seed', () => {
    const first = drawCards(ORACLE_CARDS, 3, 'reading-123');
    const second = drawCards(ORACLE_CARDS, 3, 'reading-123');
    expect(second.map((card) => card.id)).toEqual(first.map((card) => card.id));
  });
});
```

- [ ] **Step 2: Run test and confirm failure**

Run: `npm test -- tests/unit/oracle-domain.test.ts`
Expected: FAIL because `packages/oracle/src` does not exist.

- [ ] **Step 3: Implement domain types and verified catalog**

Use stable slugs and the verified meanings already established in the approved deck. Do not create placeholder cards for the missing 37.

Core types:

```ts
export type OracleReadingType = 'daily' | 'love' | 'money' | 'work' | 'emotional' | 'spiritual' | 'full';

export type OracleCard = {
  id: string;
  slug: string;
  title: string;
  shortMessage: string;
  longMessage: string;
  category: 'trust' | 'intuition' | 'acceptance' | 'inner-light' | 'guidance' | 'peace';
};

export type OracleSpreadPosition = {
  key: string;
  label: string;
};
```

`drawCards` must derive a reproducible integer stream from the seed string and perform selection without replacement.

- [ ] **Step 4: Run domain tests**

Run: `npm test -- tests/unit/oracle-domain.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/oracle/src tests/unit/oracle-domain.test.ts
git commit -m "feat: add verified oracle domain"
```

---

### Task 2: Private entitlement and owner-scoped persistence

**Files:**
- Create: `supabase/migrations/20260914_private_oracle.sql`
- Test: `tests/unit/oracle-migration.test.ts`

**Interfaces:**
- Produces tables `oracle_entitlements`, `oracle_decks`, `oracle_cards`, `oracle_readings`, `oracle_reading_cards`, `oracle_notes`, `oracle_favorites`.
- Produces SQL function `has_oracle_entitlement(entitlement_key text default 'atlas.oracle.private') returns boolean`.
- Later service code relies on the entitlement key `atlas.oracle.private`.

- [ ] **Step 1: Write failing migration source tests**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync('supabase/migrations/20260914_private_oracle.sql', 'utf8');

describe('private oracle migration', () => {
  it('creates a dedicated private entitlement and owner-only RLS', () => {
    expect(sql).toContain("'atlas.oracle.private'");
    expect(sql).toContain('auth.uid()');
    expect(sql).toContain('enable row level security');
    expect(sql).toContain('oracle_entitlements');
  });

  it('does not grant future platform admins automatically', () => {
    expect(sql).toContain('insert into public.oracle_entitlements');
    expect(sql).toContain('from public.atlas_platform_admins');
    expect(sql).not.toContain('trigger');
  });
});
```

- [ ] **Step 2: Run test and confirm failure**

Run: `npm test -- tests/unit/oracle-migration.test.ts`
Expected: FAIL because the migration file is missing.

- [ ] **Step 3: Implement migration**

Key rules:

```sql
create table if not exists public.oracle_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  entitlement_key text not null check (entitlement_key = 'atlas.oracle.private'),
  granted_at timestamptz not null default now()
);

insert into public.oracle_entitlements(user_id, entitlement_key)
select user_id, 'atlas.oracle.private'
from public.atlas_platform_admins
where enabled = true
on conflict (user_id) do nothing;
```

This is a one-time migration snapshot: currently enabled platform administrators receive the private entitlement at migration time; becoming a platform administrator later does not auto-grant Oracle.

All reading/note/favorite policies must require `(select auth.uid()) = user_id`; reading-card policies must join through `oracle_readings.user_id`. Catalog reads must require `has_oracle_entitlement()`.

Seed one deck row with `expected_card_count = 44`, `verified_card_count = 7`, `is_complete = false`, and seed only the seven verified card rows.

- [ ] **Step 4: Run migration tests**

Run: `npm test -- tests/unit/oracle-migration.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260914_private_oracle.sql tests/unit/oracle-migration.test.ts
git commit -m "feat: add private oracle RLS schema"
```

---

### Task 3: Authenticated Oracle application service

**Files:**
- Create: `supabase/functions/atlas-oracle/index.ts`
- Test: `tests/unit/oracle-service-contract.test.ts`

**Interfaces:**
- HTTP API under `/functions/v1/atlas-oracle`.
- `GET ?api=status` -> entitlement/deck completeness.
- `GET ?api=deck` -> verified cards only.
- `GET ?api=readings` -> owned reading summaries.
- `GET ?api=reading&id=<uuid>` -> owned reading detail.
- `POST ?api=create` body `{ reading_type, focus? }` -> create exactly one persisted reading with deterministic selected cards.
- `POST ?api=note` body `{ reading_id, note }`.
- `POST ?api=favorite` body `{ card_id, favorite: boolean }`.

- [ ] **Step 1: Write failing service-contract tests**

Test the source contract without external network calls:

```ts
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const source = readFileSync('supabase/functions/atlas-oracle/index.ts', 'utf8');

it('requires authenticated entitlement before oracle operations', () => {
  expect(source).toContain('has_oracle_entitlement');
  expect(source).toContain('authentication_required');
  expect(source).toContain("api === 'create'");
  expect(source).toContain("api === 'reading'");
});
```

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- tests/unit/oracle-service-contract.test.ts`
Expected: FAIL because service source is missing.

- [ ] **Step 3: Implement service**

Use the caller bearer token to resolve the authenticated user. Never use service-role authorization to bypass user RLS for reading content. Service-role use is allowed only if unavoidable for non-user content and must not be used for private rows.

For create:
1. resolve authenticated caller;
2. check `has_oracle_entitlement`;
3. load verified active card catalog;
4. generate reading UUID first;
5. use UUID string as deterministic draw seed;
6. persist `oracle_readings` then `oracle_reading_cards`;
7. return the persisted read model.

Return `403 oracle_not_entitled` if entitlement fails and `409 oracle_deck_insufficient` if the requested spread requires more verified cards than available.

- [ ] **Step 4: Run service contract tests**

Run: `npm test -- tests/unit/oracle-service-contract.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/atlas-oracle tests/unit/oracle-service-contract.test.ts
git commit -m "feat: add governed oracle service"
```

---

### Task 4: Web API client and entitlement gate

**Files:**
- Create: `apps/web/src/lib/oracleApi.ts`
- Create: `apps/web/src/modules/oracle/RequireOracleEntitlement.tsx`
- Test: `tests/unit/oracle-api.test.ts`
- Test: `tests/integration/oracle-entitlement-gate.test.tsx`

**Interfaces:**
- `getOracleStatus()`
- `listOracleReadings()`
- `getOracleReading(id)`
- `createOracleReading(input)`
- `saveOracleNote(readingId, note)`
- `setOracleFavorite(cardId, favorite)`
- `RequireOracleEntitlement` renders children only after a positive service status.

- [ ] **Step 1: Write failing API and gate tests**

Mock `global.fetch`, place a fake ATLAS token in localStorage, and assert the client calls `/functions/v1/atlas-oracle` through `authorizedAtlasFetch` behavior. Gate test must render a private-access denial on 403 without leaking the route contents.

- [ ] **Step 2: Run tests and confirm failure**

Run: `npm test -- tests/unit/oracle-api.test.ts tests/integration/oracle-entitlement-gate.test.tsx`
Expected: FAIL because files do not exist.

- [ ] **Step 3: Implement client and gate**

Use existing `authorizedAtlasFetch` from `apps/web/src/lib/atlasSession.ts`; do not introduce a second auth token store.

Gate states: `checking | entitled | denied | error`.

Denied copy: `This private ATLAS capability is not enabled for this account.`

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/unit/oracle-api.test.ts tests/integration/oracle-entitlement-gate.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/oracleApi.ts apps/web/src/modules/oracle/RequireOracleEntitlement.tsx tests/unit/oracle-api.test.ts tests/integration/oracle-entitlement-gate.test.tsx
git commit -m "feat: add private oracle access gate"
```

---

### Task 5: Oracle UI, responsive states, and route registration

**Files:**
- Create: `apps/web/src/modules/oracle/OracleRoutes.tsx`
- Create: `apps/web/src/modules/oracle/OracleHomePage.tsx`
- Create: `apps/web/src/modules/oracle/OracleReadingPage.tsx`
- Create: `apps/web/src/modules/oracle/OracleDeckPage.tsx`
- Create: `apps/web/src/modules/oracle/oracle.css`
- Modify: `apps/web/src/App.tsx`
- Test: `tests/integration/oracle-routes.test.tsx`

**Interfaces:**
- Route group mounted at `/assistant/oracle/*` inside existing ATLAS Identity plus Oracle entitlement gate.
- No `AtlasShell` global `navItems` change in Phase 1.

- [ ] **Step 1: Write failing route/UI tests**

Test direct route rendering with mocked entitlement and service data, including:
- Oracle home heading;
- daily/focused/full controls;
- `Recent readings` empty state;
- deck page truthfully shows `7 verified of 44` and `Deck incomplete`;
- reading detail exposes private note control;
- disclaimer includes `symbolic reflection` wording.

- [ ] **Step 2: Run test and confirm failure**

Run: `npm test -- tests/integration/oracle-routes.test.tsx`
Expected: FAIL because route/components are missing.

- [ ] **Step 3: Implement UI**

Home launch actions:

```ts
const readingOptions = [
  ['daily', 'Daily Reading'],
  ['love', 'Love'],
  ['money', 'Money'],
  ['work', 'Work'],
  ['emotional', 'Emotional reflection'],
  ['spiritual', 'Spiritual message'],
  ['full', 'Full Reading']
] as const;
```

Use semantic buttons, visible loading/error/success states, keyboard focus, `aria-live` for generation state, and `prefers-reduced-motion` for card-reveal effects.

The visual language is deep indigo/violet with restrained gold accents layered inside the existing ATLAS shell. Do not embed prior screenshots as backgrounds or UI substitutes.

- [ ] **Step 4: Run route/UI tests**

Run: `npm test -- tests/integration/oracle-routes.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/modules/oracle apps/web/src/App.tsx tests/integration/oracle-routes.test.tsx
git commit -m "feat: add private mystical oracle workspace"
```

---

### Task 6: ATLAS Assistant explicit intent handoff

**Files:**
- Modify: `supabase/functions/atlas-copilot/index.ts`
- Test: `tests/unit/oracle-copilot-intent.test.ts`

**Interfaces:**
- Explicit phrases such as `today's oracle reading`, `mystical cards`, `oracle reading`, and equivalent Spanish phrases route to `atlas-oracle`.
- Non-oracle prompts continue through the existing intelligence gateway unchanged.
- Oracle creation remains owned by `atlas-oracle`; Copilot must not implement its own draw algorithm.

- [ ] **Step 1: Write failing handoff test**

Extract or add a small pure helper `detectOracleIntent(message)` adjacent to the Copilot function and test representative positive and negative phrases.

Expected positives include:
- `Dame mi lectura de cartas de hoy`
- `Léeme con mis cartas místicas`
- `Give me today's oracle reading`

Expected negative:
- `Explain our accounting close status`

- [ ] **Step 2: Run and confirm failure**

Run: `npm test -- tests/unit/oracle-copilot-intent.test.ts`
Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement explicit handoff**

On oracle intent, forward the caller's `Authorization` header and current organization context to `/functions/v1/atlas-oracle?api=create`; map the detected category to a reading type. Return Oracle's persisted result as structured Assistant output. Do not send the request through the general model provider first.

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/unit/oracle-copilot-intent.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/atlas-copilot/index.ts tests/unit/oracle-copilot-intent.test.ts
git commit -m "feat: route oracle intents through shared service"
```

---

### Task 7: Privacy, RLS, and regression verification

**Files:**
- Test: `tests/unit/oracle-privacy.test.ts`
- Test: `tests/integration/oracle-regression.test.tsx`

**Interfaces:**
- Verifies source-level RLS invariants and existing shell navigation regression.

- [ ] **Step 1: Add privacy regression tests**

Assert the migration has no policy that grants read access merely by `owner`, `admin`, or organization membership; private rows must bind to `auth.uid()` ownership.

Assert `AtlasShell.tsx` does not add an Oracle global navigation item.

Assert `/assistant/oracle` remains identity-gated and entitlement-gated.

- [ ] **Step 2: Run tests**

Run: `npm test -- tests/unit/oracle-privacy.test.ts tests/integration/oracle-regression.test.tsx`
Expected: PASS.

- [ ] **Step 3: Run the complete focused suite**

Run:

```bash
npm test -- tests/unit/oracle-domain.test.ts tests/unit/oracle-migration.test.ts tests/unit/oracle-service-contract.test.ts tests/unit/oracle-api.test.ts tests/unit/oracle-copilot-intent.test.ts tests/unit/oracle-privacy.test.ts tests/integration/oracle-entitlement-gate.test.tsx tests/integration/oracle-routes.test.tsx tests/integration/oracle-regression.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/unit/oracle-privacy.test.ts tests/integration/oracle-regression.test.tsx
git commit -m "test: verify oracle privacy and regressions"
```

---

### Task 8: Full repository verification and release evidence

**Files:**
- Modify only if verification uncovers a defect directly caused by this feature.

- [ ] **Step 1: Install exactly from lockfile**

Run: `npm ci`
Expected: exit 0.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 3: Unit tests**

Run: `npm run test:unit`
Expected: exit 0.

- [ ] **Step 4: Integration tests**

Run: `npm run test:integration`
Expected: exit 0.

- [ ] **Step 5: Production build**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 6: Security/truth review**

Confirm:
- no user UUID is hardcoded;
- only verified card rows exist;
- deck reports 7/44 incomplete;
- no admin bypass exists for reading contents;
- Oracle is absent from global nav;
- Assistant delegates rather than duplicates draw logic;
- no secrets were added;
- no fabricated production metrics or provider status are shown.

- [ ] **Step 7: Open PR to `main` with evidence**

PR body must include focused-test results plus `npm ci`, typecheck, unit, integration, and build evidence.

- [ ] **Step 8: Merge and deploy only after review gates are green**

Use the repository's canonical release path. After deployment, verify:
- `/assistant/oracle` resolves without 404/500 for the entitled account;
- unauthorized account receives denial, not content;
- a created reading reopens with the same cards;
- note/favorite mutations remain owner-scoped;
- existing Finance/Payroll/Health/Studio routes still resolve.

---

## Self-Review

- Spec coverage: access model, privacy, 7 verified cards, 44-card truth state, daily/focused/full readings, Assistant reuse, Knowledge separation, disclaimers, UI states, audit-safe metadata, future rollout isolation, testing, and release gates are covered.
- Placeholder scan: no TBD/TODO/future implementation placeholders are required for Phase 1.
- Type consistency: `OracleReadingType`, `OracleCard`, entitlement key `atlas.oracle.private`, and route `/assistant/oracle` are consistent across tasks.
- Scope: public rollout, payments, organization-wide enablement, social sharing, notifications, clinical guidance, and predictive-accuracy claims remain explicitly out of Phase 1.