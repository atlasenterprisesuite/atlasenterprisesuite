# ATLAS Private Oracle — Design Specification

Date: 2026-09-14
Status: Proposed for implementation after user review
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Canonical base: `main`
Spec branch: `spec/atlas-private-oracle`

## 1. Purpose

Add a private reflective-oracle capability to ATLAS for the owner only in Phase 1. The feature uses the previously established **Mensajes del Oráculo Místico** deck and supports symbolic daily readings without presenting them as objective prediction, medical advice, financial advice, or factual forecasting.

Phase 1 is private. The architecture must allow a future public rollout without exposing the owner's historical readings.

## 2. Product placement

Primary owner: **ATLAS Assistant**
Secondary integration: **Knowledge Atlas**

Canonical route:

`/assistant/oracle`

The feature must not be implemented inside ATLAS Health. It is a reflective/personal-guidance feature, not a clinical capability.

## 3. Access model

Phase 1 access is controlled by a dedicated entitlement, for example:

`atlas.oracle.private`

Requirements:

- The route is visible only to the entitled user.
- The route is not shown in global navigation to users without the entitlement.
- Authorization is enforced server-side/data-side in addition to UI hiding.
- No hardcoded user ID in the route or components.
- Tenant administrators do not gain read access to private readings merely by being administrators.
- Future public enablement must use a separate rollout entitlement/feature flag rather than mutating the private history model.

## 4. Privacy model

All personal readings are owner-scoped.

Minimum persisted entities:

### `oracle_decks`

- `id`
- `slug`
- `name`
- `description`
- `version`
- `is_active`
- `created_at`
- `updated_at`

### `oracle_cards`

- `id`
- `deck_id`
- `slug`
- `title`
- `short_message`
- `long_message`
- `category`
- `image_asset_key`
- `position`
- `is_active`
- `created_at`
- `updated_at`

### `oracle_readings`

- `id`
- `user_id`
- `organization_id`
- `deck_id`
- `reading_type`
- `prompt_context`
- `interpretation`
- `created_at`

### `oracle_reading_cards`

- `id`
- `reading_id`
- `card_id`
- `spread_position`
- `sequence`
- `created_at`

### `oracle_notes`

- `id`
- `user_id`
- `reading_id`
- `note`
- `created_at`
- `updated_at`

### `oracle_favorites`

- `id`
- `user_id`
- `card_id`
- `created_at`

RLS requirements:

- A user can read only their own `oracle_readings`, `oracle_reading_cards` through owned readings, `oracle_notes`, and `oracle_favorites`.
- Tenant/admin role alone must not bypass private reading access.
- Deck/card catalog data can be read by entitled users.
- Audit records may record that a reading action occurred, but must not duplicate private interpretation text unless explicitly required and approved.

## 5. Initial deck

Initial product deck: **Mensajes del Oráculo Místico**.

Phase 1 should seed the canonical 44-card deck. Known approved cards include:

- CONFÍA
- ESCUCHA
- ACEPTA
- LUZ INTERIOR
- INTUICIÓN
- GUÍA DIVINA
- PAZ DEL ALMA

The remaining deck entries must come from the approved canonical deck source. Do not invent missing cards merely to reach 44. If the authoritative card list is incomplete at implementation time, ship only verified cards and expose deck completeness truthfully.

## 6. Reading experiences

### Daily reading

Default spread:

1. Energy of the day
2. What to notice
3. Direction / advice

### Focused readings

Supported initial categories:

- Love
- Money
- Work
- Emotional reflection
- Spiritual message

### Full reading

Seven-position spread:

1. General energy
2. Love
3. Money
4. Work
5. Challenge
6. Advice
7. Closing message

The system must label the result as symbolic/reflection-oriented. It must not claim certainty, supernatural verification, diagnosis, or guaranteed outcomes.

## 7. Card selection and interpretation

Card selection should be deterministic-per-reading once generated and persisted, so reopening a reading does not redraw cards.

A reading request creates one persisted reading and its associated selected cards. Interpretation can be generated from:

- selected card meanings,
- spread position,
- user-provided focus/question,
- optional prior reading context only when the user explicitly asks for continuity.

The feature must not silently use unrelated private ATLAS data to personalize a reading. Cross-module personalization requires an explicit user action or approved integration surface.

## 8. UI

Visual direction:

- ATLAS-compatible dark shell
- violet / deep indigo base
- gold accents
- lunar / mystical motifs
- responsive desktop, tablet, and mobile
- no screenshot-as-UI implementation

Required states:

- locked / not entitled
- loading
- empty history
- drawing / generating
- success
- failure
- retry
- offline/degraded messaging where applicable

Primary screens:

### `/assistant/oracle`

Oracle home with:

- Daily Reading
- Focused Reading
- Full Reading
- Recent Readings
- Favorites
- Deck Library

### `/assistant/oracle/readings/:readingId`

Persisted reading detail with cards, interpretation, timestamp, private note, favorite controls, and delete/archive behavior if supported by current ATLAS patterns.

### `/assistant/oracle/deck`

Deck browser with verified card catalog.

## 9. Navigation

Do not add Oracle as a general enterprise navigation item in Phase 1.

Preferred discovery paths:

- ATLAS Assistant private tools surface
- owner-only quick action
- direct route for the entitled owner

Global navigation can expose it only in a later public phase behind an explicit rollout flag.

## 10. ATLAS Assistant integration

ATLAS Assistant should recognize explicit intents such as:

- “Give me today’s oracle reading.”
- “Read love with my mystical cards.”
- “Open my last oracle reading.”

Assistant actions must route through the same application service used by the UI rather than duplicating reading logic.

Suggested service boundary:

`OracleReadingService`

Responsibilities:

- verify entitlement
- load verified deck/cards
- choose cards
- persist reading
- retrieve owned history
- apply owner-only authorization
- produce structured interpretation input/output

## 11. Knowledge Atlas integration

Knowledge Atlas may host explanatory metadata about symbolism, archetypes, card meanings, traditions, and interpretation references.

It must not become the owner of private reading history.

## 12. Safety and wording

Every reading surface must communicate that readings are symbolic and reflective.

Do not present outputs as:

- guaranteed predictions
- verified supernatural facts
- medical diagnosis/treatment guidance
- investment or financial instruction
- legal advice

For high-stakes user prompts, ATLAS should separate reflective language from factual guidance and redirect actionable high-stakes decisions to the appropriate ATLAS module or qualified real-world source.

## 13. Future public rollout

Phase 2 may expose the module to additional users through a public entitlement such as:

`atlas.oracle.enabled`

Public rollout must preserve:

- owner history privacy
- per-user RLS
- organization-level enable/disable capability if later required
- onboarding/consent
- clear disclaimers
- telemetry that does not contain private reading content by default

No migration should convert private owner readings into organization-visible data.

## 14. Audit and observability

Audit events may record:

- oracle.reading.created
- oracle.reading.viewed
- oracle.note.updated
- oracle.favorite.added
- oracle.favorite.removed

Audit payloads should use IDs, timestamps, and action metadata rather than full private reading prose.

Operational metrics can include counts, latency, failures, and feature usage without storing sensitive reading text in telemetry.

## 15. Testing

Required test layers:

### Authorization

- non-entitled user cannot access route
- non-entitled user cannot call reading service
- entitled owner can access
- admin cannot read another user’s private history
- direct record access is rejected by RLS

### Functional

- daily reading persists exactly once
- reopened reading returns same selected cards
- focused reading categories work
- notes persist only for owner
- favorites add/remove correctly
- empty deck state is truthful

### UI

- desktop/tablet/mobile responsive behavior
- loading, empty, error, success states
- keyboard navigation
- screen-reader labels
- reduced-motion support where animation is present

### Regression

- existing ATLAS Assistant routes remain valid
- existing shell navigation is unchanged for non-entitled users
- no regression to identity, tenant, or RBAC behavior

## 16. Implementation boundaries

Phase 1 does not include:

- public marketplace distribution
- payments
- organization-wide access
- social sharing by default
- automated push notifications
- health/clinical interpretation
- claims of predictive accuracy

## 17. Acceptance criteria

Phase 1 is complete when:

1. The entitled owner can open `/assistant/oracle`.
2. Other users cannot discover or access the feature.
3. A reading can be created, persisted, reopened, and privately annotated.
4. RLS prevents cross-user access.
5. The verified Mystical Oracle deck is loaded without invented cards.
6. The UI matches ATLAS visual identity and the approved violet/gold mystical direction.
7. Assistant intents use the same underlying reading service.
8. Tests cover authorization, persistence, UI states, and regressions.
9. Build, typecheck, and test gates pass before merge.
10. No merge to `main` and no production deploy occur without a separate explicit approval.
