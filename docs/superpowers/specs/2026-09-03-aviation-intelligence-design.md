# ATLAS Aviation Intelligence — Design Specification

Date: 2026-09-03
Status: Approved design
Owner module: ATLAS Mobility → Aviation
Secondary integrations: ATLAS Finance, ATLAS Analytics, ATLAS Security, ATLAS Maps / GPS 4D, ATLAS Drive, ATLAS Voice, ATLAS Connect
Source visual: user-provided Doroni / Instagram screenshot interpreted as a product-specification reference, not as a request to copy proprietary UI or assets.

## 1. Product intent

ATLAS Aviation Intelligence turns the visual concept of a promoted advanced-air-mobility aircraft into a real ATLAS product surface for researching aircraft, manufacturers, certification progress, market and investment information, documents, alerts, and future operational workflows.

The feature must preserve ATLAS truthfulness rules:

- No promotional claim may be presented as verified fact without a source and timestamp.
- No aircraft may be shown as certified, operational, available, live, funded, connected, or investable unless the underlying source supports that state.
- No share price, valuation, market size, minimum investment, certification milestone, delivery date, or performance metric may be hardcoded as production truth.
- Investment information is research and intelligence unless ATLAS is connected to an authorized and compliant transaction provider. The first implementation does not act as a broker-dealer or execute securities transactions.
- Proprietary Doroni, Instagram, manufacturer, or third-party design assets are not copied. ATLAS uses its own identity, components, layout, and data model.

## 2. Product hierarchy

Primary navigation depth:

ATLAS Mobility
→ Aviation
→ Aircraft Intelligence
→ Aircraft record
→ Overview / Specifications / Certification / Company / Investment / Documents / News
→ Final action

Additional Aviation destinations planned behind the same module boundary:

- Manufacturers
- Certification Tracker
- Market Intelligence
- Saved Aircraft
- Alerts
- Vertiports
- Air Corridors
- Fleet Operations
- Maintenance
- Charging / Energy
- Pilot / Owner Records

Only Aircraft Intelligence, Certification Tracker, Saved Aircraft, and Alerts belong to the first implementation plan. Operational destinations stay out of scope until their data and provider dependencies are defined.

## 3. Existing ATLAS architecture to reuse

The design is based on the application foundation already present on branch `feat/site-review-center-foundation` and intentionally extends it rather than creating another application shell.

Reuse these existing boundaries and patterns:

- `src/core/routes.js` for route resolution.
- `src/core/permissions.js` for capability checks.
- `src/index.html` as the shared application shell until shell extraction becomes necessary.
- `src/styles.css` for ATLAS design tokens and responsive breakpoints.
- `src/app.js` as the current application entry point.
- `src/modules/*` as the module ownership pattern.
- Node 22, zero-runtime-dependency foundation, test-first changes, and deterministic local behavior.

Target module boundary:

`src/modules/aviation/`

Suggested internal units:

- `aviation-store.js` — persistence boundary / repository interface.
- `aviation-service.js` — business rules and record composition.
- `aviation-sources.js` — source metadata normalization.
- `aviation-status.js` — certification and evidence status model.
- `aviation-ui.js` — view models and DOM rendering for the first implementation.
- `aviation-alerts.js` — saved watch conditions and alert evaluation.

The first implementation may use in-memory persistence because the current ATLAS foundation does. The service interface must be shaped so storage can later move to a durable backend without changing UI consumers.

## 4. Route design

Initial routes:

- `/mobility/aviation`
  Aviation home / discovery.
- `/mobility/aviation/aircraft`
  Searchable aircraft index.
- `/mobility/aviation/aircraft/:aircraftId`
  Aircraft detail.
- `/mobility/aviation/certification`
  Cross-aircraft certification tracker.
- `/mobility/aviation/saved`
  Saved aircraft and watches.
- `/mobility/aviation/alerts`
  Alert history and configuration.

Aircraft detail uses in-page tabs rather than separate routes for the first implementation:

- Overview
- Specifications
- Certification
- Company
- Investment
- Documents
- News

Tabs must update visible content and accessibility state. A later router upgrade may deep-link tabs with query or sub-route state, but that is not required for the initial slice.

## 5. Visual direction

The screenshot is interpreted as three useful design cues only:

1. A visually dominant vehicle image / product hero.
2. Immediate display of the most decision-relevant status and market facts.
3. A prominent final action.

ATLAS transforms those cues into a darker, intelligence-first aircraft command surface rather than an advertisement.

### 5.1 ATLAS visual language

Continue the existing ATLAS foundation:

- Dark navy / near-black environment.
- Cyan and electric-indigo accents.
- Glassy but restrained panels.
- Thin translucent borders.
- High-contrast typography.
- Compact uppercase eyebrow labels.
- Rounded cards consistent with current ATLAS tokens.
- Status colors reserved for semantic meaning, not decoration.
- No fake holograms, fake live badges, or invented telemetry.

Aviation adds a subtle technical layer:

- Aircraft silhouette / media framed inside a controlled hero surface.
- Certification timeline and evidence provenance displayed as structured data.
- Optional grid / trajectory motif only as background decoration.
- Technical specifications presented with clear units and source timestamps.

## 6. Screen designs

### 6.1 Desktop — Aviation Home

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ ATLAS sidebar │ Mobility / Aviation                    Search   Alerts  ◉ │
│               ├────────────────────────────────────────────────────────────┤
│ Mobility      │ AVIATION INTELLIGENCE                                        │
│  • Aviation   │ Research aircraft, certification, companies and market data │
│  • Ride       │                                                            │
│  • Maps       │ [ Search aircraft, manufacturer or model... ] [Filters]   │
│               │                                                            │
│               │ ┌──────────────── Featured aircraft ────────────────────┐ │
│               │ │ [aircraft media]     Model / manufacturer             │ │
│               │ │                      Certification: Evidence status    │ │
│               │ │                      Updated: timestamp                │ │
│               │ │                      [Open aircraft] [Save]            │ │
│               │ └────────────────────────────────────────────────────────┘ │
│               │                                                            │
│               │ Certification tracker   Saved aircraft   Recent evidence   │
│               │ ┌───────────────┐       ┌─────────────┐  ┌──────────────┐ │
│               │ │ stages/status │       │ watch list  │  │ source cards │ │
│               │ └───────────────┘       └─────────────┘  └──────────────┘ │
│               │                                                            │
│               │ Aircraft directory                                          │
│               │ [cards / list with filters, source badge, latest status]    │
└────────────────────────────────────────────────────────────────────────────┘
```

Key interactions:

- Global aircraft search filters immediately.
- Filters include aircraft type, propulsion, certification state, manufacturer, country/authority when supported by data.
- Featured aircraft uses real records only. If none exist, show a configuration / empty state.
- Save button respects permissions and changes state visibly.
- Evidence cards always show source and last-checked timestamp.

### 6.2 Desktop — Aircraft Detail

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ Breadcrumb: Mobility / Aviation / Aircraft / <Model>                      │
├────────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────── Aircraft hero ──────────────────────────────────┐ │
│ │ [verified media or neutral placeholder]                               │ │
│ │ Manufacturer • Model                              [Save] [Set alert]    │ │
│ │ One-line factual summary                                                │ │
│ │                                                                          │ │
│ │ Certification      Development        Evidence freshness                │ │
│ │ [status chip]      [status chip]      [timestamp]                       │ │
│ └──────────────────────────────────────────────────────────────────────────┘ │
│                                                                            │
│ Overview | Specifications | Certification | Company | Investment | Docs | News│
│ ────────────────────────────────────────────────────────────────────────── │
│ Main content                                               Evidence rail    │
│ ┌───────────────────────────────────────────────────┐  ┌─────────────────┐ │
│ │ tab-specific content                             │  │ Source          │ │
│ │                                                   │  │ Authority       │ │
│ │                                                   │  │ Retrieved       │ │
│ │                                                   │  │ Confidence      │ │
│ └───────────────────────────────────────────────────┘  └─────────────────┘ │
└────────────────────────────────────────────────────────────────────────────┘
```

The hero must never use marketing phrases such as “market unlocked” as a factual headline unless ATLAS displays them explicitly as a quoted issuer claim with provenance.

### 6.3 Investment tab

```text
┌──────────────────────────── Investment Intelligence ───────────────────────┐
│ Classification: issuer offering / public security / unavailable / unknown │
│ Source checked: <timestamp>                     Evidence: <source>         │
│                                                                            │
│ Offering data                 Company context                              │
│ Share price       <value>     Funding stage            <value>             │
│ Minimum            <value>     Valuation / cap          <value>             │
│ Offering status    <value>     Security type            <value>             │
│                                                                            │
│ [Risk & disclosure panel]                                                     │
│ Early-stage investments may be illiquid and may result in total loss.      │
│                                                                            │
│ [View official offering / source]                                           │
└────────────────────────────────────────────────────────────────────────────┘
```

Rules:

- All monetary fields can be null.
- Stale fields are visibly labeled stale, not silently reused.
- The CTA is an external-source / official-offering action unless a compliant ATLAS transaction integration is explicitly added later.
- No “Complete your investment” button exists in the first implementation.

### 6.4 Certification tab

```text
┌──────────────────────────── Certification Tracker ─────────────────────────┐
│ Authority        Program / pathway               Last verified             │
│ <authority>      <program or category>           <timestamp>               │
│                                                                            │
│ Timeline                                                                   │
│ ● Announced ── ● Application ── ◐ Testing ── ○ Approved ── ○ Operational  │
│                      ↑ current evidence-supported stage                    │
│                                                                            │
│ Evidence entries                                                           │
│ [date] [source type] [status] [summary] [open source]                      │
└────────────────────────────────────────────────────────────────────────────┘
```

Timeline stages must be generic ATLAS stages. The service maps source evidence into the closest supported stage while preserving the original source wording in the evidence record.

### 6.5 Mobile — Aircraft Detail

```text
┌─────────────────────────────┐
│ ‹ Aviation       Save  Alert│
│                             │
│ [aircraft media / placeholder]
│ Manufacturer                │
│ MODEL                       │
│ factual summary             │
│                             │
│ Cert status   Freshness     │
│ Dev status    Source count  │
│                             │
│ [horizontal tab scroller]   │
│ Overview Specifications ... │
│                             │
│ tab content                 │
│                             │
│ Evidence                    │
│ source • timestamp • state  │
└─────────────────────────────┘
```

Mobile rules:

- Sidebar collapses into the existing mobile navigation pattern.
- Hero information stacks.
- Tabs scroll horizontally and remain keyboard accessible.
- Evidence moves below main content rather than becoming a narrow side rail.
- Primary actions remain reachable without fixed overlays covering content.

### 6.6 Empty, loading, error, stale and restricted states

Every data-driven region supports:

- `empty` — no records configured.
- `loading` — provider / repository read in progress.
- `ready` — evidence-backed data available.
- `stale` — known data exists but freshness threshold has expired.
- `not_configured` — required source integration is absent.
- `error` — source or processing failure.
- `restricted` — user lacks capability.

ATLAS must distinguish `not_configured` from `error` and `empty`.

## 7. Data model

### 7.1 Aircraft

```text
Aircraft
- id
- slug
- manufacturerId
- model
- displayName
- category
- propulsion
- seatCount
- description
- media[]
- specificationSetId
- certificationProgramIds[]
- companyId
- investmentProfileId?
- createdAt
- updatedAt
```

### 7.2 SpecificationSet

```text
SpecificationSet
- id
- aircraftId
- fields[]
  - key
  - label
  - value
  - unit?
  - sourceId
  - observedAt
  - confidence
```

No specification field is accepted without a `sourceId` unless it is explicitly marked as operator-entered internal data.

### 7.3 EvidenceSource

```text
EvidenceSource
- id
- sourceType
- publisher
- title
- canonicalUrl?
- authority?
- retrievedAt
- publishedAt?
- trustClass
- status
```

Suggested `sourceType` values:

- regulator
- manufacturer
- issuer
- filing
- press
- operator
- internal

Suggested `trustClass` values:

- primary_authority
- primary_party
- secondary_reputable
- internal_verified
- unverified

### 7.4 CertificationProgram

```text
CertificationProgram
- id
- aircraftId
- authority
- programName
- jurisdiction
- normalizedStage
- sourceWording
- evidenceIds[]
- lastVerifiedAt
```

Normalized stages:

- announced
- application
- accepted
- testing
- review
- approved
- operational
- suspended
- unknown

The normalized stage is not a claim that every regulator uses this exact terminology.

### 7.5 InvestmentProfile

```text
InvestmentProfile
- id
- companyId
- aircraftIds[]
- offeringClass
- securityType?
- sharePrice?
- currency?
- minimumInvestment?
- valuation?
- offeringStatus
- officialActionUrl?
- sourceIds[]
- lastVerifiedAt
```

`offeringStatus` examples:

- active
- paused
- closed
- unavailable
- unknown

### 7.6 SavedAircraft / AlertRule

```text
SavedAircraft
- userId
- aircraftId
- savedAt

AlertRule
- id
- userId
- aircraftId?
- companyId?
- eventTypes[]
- enabled
- createdAt
- lastEvaluatedAt?
```

First event types:

- certification_stage_changed
- investment_terms_changed
- new_primary_evidence
- aircraft_status_changed

## 8. Source provenance and freshness

Every displayed claim should be traceable to evidence.

UI presentation rules:

- Show the source publisher or authority near high-impact claims.
- Show “Verified <time>” or “Updated <time>” based on source retrieval time.
- Mark stale records when `now - lastVerifiedAt` exceeds a configured threshold.
- Do not automatically overwrite a higher-trust primary source with a lower-trust source.
- Conflicting evidence must be retained and surfaced as a conflict instead of silently choosing whichever claim is newer.

First implementation may ingest seed records manually in code for testing only, but sample records must be explicitly labeled fixture / demo and must not render as production truth on a production environment.

## 9. Permissions

Extend the central capability model rather than creating Aviation-specific role logic in the UI.

Suggested capabilities:

- `aviation.view`
- `aviation.search`
- `aviation.save`
- `aviation.alerts.manage`
- `aviation.sources.view`
- `aviation.sources.manage`
- `aviation.records.manage`
- `aviation.investment.view`
- `aviation.admin`

Role mapping can begin by reusing the foundation roles, but authorization must always check capabilities.

Sensitive actions:

- editing source records
- changing normalized certification state
- editing investment terms
- deleting evidence

must require an elevated capability and should be audit-log ready.

## 10. Core interactions

### Search

- Search model, manufacturer, category, and indexed factual summary.
- Empty query restores the full permitted result set.
- Search must operate on actual records only.

### Filters

- Multi-criteria filters combine rather than overwrite each other.
- Reset restores the unfiltered result set.
- Active filters are visible.

### Save

- Save toggles persisted watch state.
- Disabled / restricted state appears when the capability is missing.

### Alerts

- User selects event types.
- Rule validates before save.
- Alert history references the evidence that caused the alert.
- No alert fires when the relevant evidence is unchanged.

### Evidence

- Every evidence card can expose publisher, source type, retrieved date, claim status, and source action.
- Broken or absent source URLs do not become clickable placeholders.

## 11. Error handling

Service errors return typed results rather than forcing UI code to parse messages.

Suggested error identifiers:

- `aircraft_not_found`
- `source_not_found`
- `invalid_aircraft_record`
- `invalid_certification_transition`
- `investment_data_unavailable`
- `capability_required`
- `source_conflict`

The UI converts these into user-facing messages while preserving technical detail for logs / future audit channels.

## 12. Security and compliance boundaries

- No secrets in client code or repository fixtures.
- External provider credentials remain server-side when such integrations are added.
- URLs must be validated before use in outbound actions.
- User-provided source content is treated as untrusted input.
- HTML from external sources is not injected directly into the ATLAS DOM.
- Investment data must retain issuer / filing provenance.
- ATLAS must not imply regulatory approval, certification, suitability, guaranteed returns, or investment safety.
- Future transaction execution requires a separately approved architecture and regulated-provider integration.

## 13. Accessibility

- All tabs use correct tab / tabpanel semantics.
- Status information is not conveyed by color alone.
- Focus states remain visible.
- Search and filters are labeled.
- Aircraft media has descriptive alternative text when meaningful media exists.
- Decorative trajectory / grid motifs are hidden from assistive technology.
- Mobile controls meet practical touch target sizes.

## 14. Responsive behavior

Desktop >= 1180px:

- Full sidebar.
- Two-column detail view with evidence rail.
- Dense aircraft directory.

Tablet 900–1179px:

- Compact sidebar consistent with current foundation.
- Detail content remains two-column only where minimum content width is preserved; otherwise evidence drops below.
- Search and filters wrap without horizontal overflow.

Mobile < 900px:

- No desktop sidebar.
- Single-column application.
- Hero and metadata stack.
- Tabs scroll horizontally.
- Cards use full width.
- Tables, where unavoidable, become stacked data rows or horizontal scroll regions with explicit labels.

## 15. Testing strategy

Unit tests:

- route resolution
- aircraft search
- combined filters
- source trust selection
- source conflict preservation
- stale-state calculation
- certification normalization
- invalid certification transitions
- investment null / unavailable behavior
- capability checks
- save toggle
- alert evaluation

UI-model tests:

- empty home state
- aircraft list rendering
- aircraft detail rendering
- tab state
- restricted action state
- stale badge
- conflicting evidence state
- investment disclosure visibility
- mobile-friendly model ordering

Server / route tests:

- all Aviation routes return 200 when valid
- invalid aircraft returns controlled 404 state
- unknown routes remain 404
- existing `/sites/review` route does not regress

Manual verification before completion:

- desktop / tablet / mobile widths
- keyboard navigation
- search
- filters
- tabs
- save
- alert create / disable
- source open behavior
- empty, error, stale, restricted, and not-configured states
- no invented live status or metrics
- secret-pattern scan
- placeholder scan

## 16. Implementation sequence

1. Generalize route registry so Site Review and Aviation can coexist without a one-off router.
2. Generalize navigation data so multiple ATLAS modules render from one source.
3. Add Aviation domain models and deterministic in-memory repository.
4. Add Aviation service and provenance rules.
5. Add Aviation routes and view models.
6. Add Aviation home and aircraft directory.
7. Add aircraft detail and tabs.
8. Add certification tracker.
9. Add saved aircraft and alerts.
10. Add investment-intelligence read-only surface with provenance and disclosures.
11. Add responsive states and accessibility.
12. Add complete unit, route, UI-model, and regression tests.

## 17. Explicit non-goals for this implementation

- No aircraft purchase or booking.
- No securities transaction execution.
- No live FAA integration until an authorized source connector is selected and configured.
- No live manufacturer scraping presented as reliable production data.
- No autonomous flight control.
- No vertiport booking.
- No flight dispatch.
- No fabricated telemetry, market metrics, certification states, or investment terms.
- No copied Doroni / Instagram visual identity.

## 18. Acceptance criteria

The Aviation feature is design-complete when:

- It is owned by ATLAS Mobility → Aviation.
- It reuses the existing ATLAS shell, route, permission, styling, and module patterns.
- Routes and navigation are explicitly defined.
- Desktop, tablet, and mobile visual layouts are defined.
- Aircraft, evidence, certification, investment, save, and alert data models are defined.
- Source provenance and stale/conflict behavior are explicit.
- Investment boundaries and disclosures are explicit.
- Empty, loading, ready, stale, not-configured, error, and restricted states are defined.
- Accessibility, security, permissions, and testing expectations are included.
- The implementation can proceed without inventing missing product behavior.
