# ATLAS Hospitality Discover & Local Commerce Design

Date: 2026-09-12
Status: Direction approved; written specification pending owner review
Owner: ATLAS Hospitality
Canonical repository: `atlasenterprisesuite/atlasenterprisesuite`
Target branch: `feat/hospitality-discover-local-commerce`

## 1. Objective

Extend the existing ATLAS Hospitality domain with a separate Discover & Local Commerce subsystem that turns local places, offers, itinerary planning, hotel concierge flows, partner campaigns, attribution, and AI-assisted discovery into a governed ATLAS product surface.

The subsystem must reuse ATLAS identity, tenant/org boundaries, shared navigation, audit patterns, Supabase backend direction, Cloudflare production path, ATLAS Assistant, Creator Studio, CRM, Finance/Accounting, ATLAS Pay, and Ride integrations when those capabilities are available and authorized.

This subsystem must not duplicate or weaken the existing Hospitality Access subsystem. Hotel room access remains a separate privileged capability and source-of-truth boundary.

## 2. Product thesis

ATLAS Hospitality Discover combines:

- local map and search;
- structured place discovery;
- hotel digital concierge;
- verified offers and coupons;
- itinerary generation;
- partner and merchant management;
- sponsored campaigns with clear labeling;
- conversion and redemption attribution;
- AI-assisted planning through ATLAS Assistant;
- optional Ride, Pay, CRM, Creator, Analytics, and Accounting integrations.

The goal is not to replicate a static tourism guide. The goal is to create an intelligent local-commerce layer that can serve travelers, hotel guests, residents, merchants, hotels, destination operators, and ATLAS administrators.

## 3. Scope

### 3.1 Visitor-facing scope

The first milestone supports:

- browse places by category and region;
- search places by text and structured filters;
- interactive map/list synchronization;
- place detail pages;
- truthful hours and verification state when available;
- distance and geographic context when user location is authorized;
- verified active offers;
- save/favorite intent when the signed-in identity supports it;
- AI itinerary generation from selected or searched places;
- hotel concierge landing experience scoped to a property when a valid property context exists;
- multilingual content support beginning with English, Spanish, and Portuguese for ATLAS-authored UI and structured merchant fields where translations exist;
- deep-link or QR entry into hotel/property/merchant campaigns;
- optional handoff to Ride, booking, merchant website, phone, directions, or ATLAS Pay only when the corresponding integration is real and permitted.

### 3.2 Partner-facing scope

The first milestone supports:

- partner organization and merchant profile management;
- location management;
- offer creation and lifecycle;
- campaign creation and sponsorship metadata;
- campaign targeting by allowed geography/category/property context;
- media references using authorized/licensed assets only;
- analytics for impressions, clicks, directions, saves, redemptions, and attributable actions when technically observable;
- hotel/property concierge configuration for approved partners and offers;
- verification status and provenance controls.

### 3.3 ATLAS admin scope

- partner verification;
- content moderation;
- provenance review;
- campaign review;
- fraud/abuse controls;
- offer lifecycle controls;
- analytics integrity monitoring;
- permissions and audit review;
- source/data health monitoring.

## 4. Explicit non-goals

The first milestone does not:

- scrape or bulk-copy protected third-party tourism directories;
- copy protected maps, editorial descriptions, coupon artwork, merchant photography, or advertisements;
- reverse engineer private APIs;
- treat public URL parameters as credentials;
- claim an external merchant, booking, hotel, transport, or payment system is live without evidence;
- mix guest discovery authorization with room-access authorization;
- allow paid ranking for emergency, health-safety, law-enforcement, or other high-stakes recommendations;
- make unsupported reservations or payments;
- manufacture ratings, reviews, popularity, availability, pricing, opening hours, deal inventory, or conversion metrics.

## 5. Architectural boundary

Hospitality owns the user journey, but Discover & Local Commerce is a distinct domain from Hospitality Access.

Recommended ownership:

- `packages/hospitality-discover/` for normalized domain types, ranking contracts, offer rules, attribution contracts, and shared business logic;
- `apps/web/src/modules/hospitality/discover/` for visitor-facing web routes;
- `apps/web/src/modules/hospitality/partners/` for merchant/hotel partner surfaces;
- `apps/web/src/lib/hospitalityDiscoverApi.ts` for browser API access;
- `supabase/functions/atlas-hospitality-discover/` for governed server-side operations;
- Supabase migrations for discovery, commerce, attribution, and partner tables;
- shared ATLAS audit and identity utilities where already available.

No new standalone application is created unless a later approved architecture requires one.

## 6. Route model

Visitor routes:

- `/hospitality/discover`
- `/hospitality/discover/map`
- `/hospitality/discover/places/:placeId`
- `/hospitality/discover/deals`
- `/hospitality/discover/deals/:offerId`
- `/hospitality/discover/itineraries`
- `/hospitality/discover/itineraries/:itineraryId`
- `/hospitality/discover/concierge/:propertySlug`

Partner routes:

- `/hospitality/partners`
- `/hospitality/partners/places`
- `/hospitality/partners/places/:placeId`
- `/hospitality/partners/offers`
- `/hospitality/partners/offers/:offerId`
- `/hospitality/partners/campaigns`
- `/hospitality/partners/campaigns/:campaignId`
- `/hospitality/partners/analytics`

Admin routes may live under the existing governed admin/security structure rather than be duplicated inside Hospitality.

## 7. Core domain model

### 7.1 Place

`HospitalityPlace`

- `id`
- `org_id` when partner-owned; nullable for approved public catalog records when architecture permits
- `partner_id`
- `name`
- `slug`
- `category_id`
- `primary_location_id`
- `short_description`
- `long_description`
- `website_url`
- `phone_e164`
- `price_level` when sourced and allowed
- `status`
- `verification_status`
- `source_record_id`
- `created_at`
- `updated_at`

### 7.2 Location

`HospitalityPlaceLocation`

- `id`
- `place_id`
- `org_id`
- `property_context_id` when relevant
- `address_line_1`
- `address_line_2`
- `city`
- `region`
- `postal_code`
- `country_code`
- `latitude`
- `longitude`
- `timezone`
- `phone_e164`
- `hours_json`
- `hours_verified_at`
- `verification_status`
- `source_record_id`

### 7.3 Category

`HospitalityCategory`

Examples:

- attractions;
- theme parks;
- dining;
- nightlife;
- shopping;
- hotels;
- golf;
- entertainment;
- visitor services;
- transportation;
- events;
- family;
- wellness;
- other approved categories.

Categories must be normalized and stable enough for analytics and filtering.

### 7.4 Region

`HospitalityRegion`

Supports destination-level geographic grouping such as:

- International Drive;
- Universal area;
- Disney/Lake Buena Vista;
- Downtown Orlando/Winter Park;
- Orlando International Airport area;
- Kissimmee;
- St. Cloud;
- future destinations outside Central Florida.

Regions are ATLAS taxonomy objects, not copied branding from another publisher.

### 7.5 Offer

`HospitalityOffer`

- `id`
- `partner_id`
- `place_id`
- `location_scope`
- `title`
- `description`
- `offer_type`
- `discount_value`
- `currency`
- `starts_at`
- `ends_at`
- `inventory_limit`
- `per_user_limit`
- `eligibility_json`
- `redemption_mode`
- `redemption_code_reference`
- `terms`
- `status`
- `verification_status`
- `created_by`
- `created_at`
- `updated_at`

Raw reusable redemption secrets must not be returned to unauthorized clients.

### 7.6 Redemption

`HospitalityOfferRedemption`

- `id`
- `offer_id`
- `partner_id`
- `place_id`
- `location_id`
- `user_id` when authenticated and lawful;
- `anonymous_session_id` when appropriate and consented;
- `redemption_reference`
- `status`
- `redeemed_at`
- `source_campaign_id`
- `attribution_touch_id`
- `metadata_json`

### 7.7 Partner

`HospitalityPartner`

- `id`
- `org_id`
- `partner_type`
- `legal_name`
- `display_name`
- `verification_status`
- `billing_customer_reference` when an authorized billing rail exists
- `crm_reference` when an ATLAS CRM record exists
- `status`
- `created_at`
- `updated_at`

Partner types include merchant, hotel/property, destination operator, attraction operator, advertiser, and approved agency.

### 7.8 Campaign

`HospitalityCampaign`

- `id`
- `partner_id`
- `name`
- `campaign_type`
- `placement_type`
- `targeting_json`
- `starts_at`
- `ends_at`
- `budget_reference`
- `billing_model`
- `sponsorship_label`
- `status`
- `review_status`
- `created_at`
- `updated_at`

### 7.9 Source record and provenance

`HospitalitySourceRecord`

- `id`
- `source_type`
- `source_name`
- `source_url`
- `source_external_id`
- `license_or_rights_basis`
- `retrieved_at`
- `last_verified_at`
- `verification_status`
- `checksum_or_version`
- `raw_reference` only when retention is lawful and necessary
- `notes`

Every externally sourced business fact that can become stale should be attributable to a source record where technically practical.

## 8. Data-source policy

Allowed sources include:

- merchant/partner self-service submissions;
- hotel/property supplied content;
- authorized third-party APIs;
- government or tourism authority public data where terms permit;
- licensed mapping/place providers;
- structured public data whose terms permit use;
- ATLAS-authored taxonomies and translations;
- manually verified records.

Disallowed behavior includes unauthorized bulk copying, bypassing technical controls, copying protected descriptions/artwork, or storing data contrary to license or terms.

A source adapter must expose:

- source identity;
- permitted fields;
- data freshness;
- attribution requirements;
- update semantics;
- deletion/correction semantics.

## 9. Truth and freshness model

Data states:

- `unverified`
- `partner_asserted`
- `source_verified`
- `atlas_verified`
- `stale`
- `conflicted`
- `disabled`

UI must not convert `partner_asserted` into a stronger claim such as Verified without evidence.

Hours, offers, availability, price, and temporary status require stricter freshness than durable facts such as business name or street address.

## 10. Search and ranking

Organic ranking may consider:

- text relevance;
- category match;
- geographic relevance;
- currently open state only when freshness supports it;
- user-selected budget/preferences;
- accessibility metadata;
- verified active offer relevance;
- property/concierge context;
- user-provided itinerary constraints;
- data quality/freshness.

Organic ranking must not silently use sponsorship as relevance.

Sponsored placement is a separate candidate stream and must be clearly labeled.

High-stakes categories must exclude sponsored ranking when monetization could distort safety-sensitive recommendations.

## 11. Sponsored content model

Supported sponsored surfaces may include:

- sponsored place card;
- sponsored category placement;
- hotel-concierge featured offer;
- sponsored itinerary suggestion block when clearly labeled and not safety-critical;
- promoted deal.

Required rules:

1. Clear Sponsored/Promoted label.
2. Organic alternatives remain available.
3. Sponsorship never changes factual verification state.
4. Sponsorship does not override explicit user constraints.
5. No concealed payment influence in ATLAS Assistant responses.
6. Billing and delivery metrics must be auditable.
7. Campaign targeting must respect privacy and consent rules.

## 12. Map experience

The map is a first-class interaction surface, not decorative UI.

Required behavior:

- pins correspond to current result set;
- map movement can optionally update search with explicit UX state;
- selecting a list card selects the matching pin;
- selecting a pin opens or focuses the matching card;
- filters affect both map and list;
- map viewport and result counts remain synchronized;
- directions handoff uses an authorized provider or platform capability;
- no map provider is presented as connected until configured.

The implementation should prefer an adapter boundary so ATLAS can change mapping providers without rewriting business logic.

## 13. Hotel concierge model

A property-scoped concierge context may define:

- property identity;
- guest-facing brand presentation within ATLAS brand rules;
- preferred categories;
- approved partner list;
- sponsored placements;
- property-specific offers;
- transportation handoff preferences;
- check-in/check-out context only when lawful and available;
- multilingual defaults;
- QR/deep-link entry point.

A property concierge context does not grant access to room credentials or door systems.

No reservation or guest PII is consumed unless the hotel integration is authorized and the purpose is defined.

## 14. QR and deep-link model

QR codes may resolve to signed or canonical ATLAS links representing:

- property concierge;
- place;
- offer;
- campaign;
- itinerary;
- partner acquisition page.

QRs must not contain raw provider credentials, payment secrets, door-access material, or reusable privileged tokens.

Creator Studio may generate visual QR assets from canonical ATLAS URLs.

## 15. Itinerary engine

The itinerary engine uses a normalized request:

`ItineraryRequest`

- starting location or allowed area;
- date/time window;
- party size;
- budget;
- interests/categories;
- accessibility needs;
- transportation mode;
- fixed stops;
- excluded categories;
- deal preference;
- language;
- hotel/property context when available.

The engine returns:

- ordered stops;
- estimated sequence/travel context when a real routing source exists;
- reasons for each recommendation;
- active offers when verified;
- uncertainty/freshness notes;
- optional Ride/booking/pay actions only when integrations are available.

ATLAS Assistant may orchestrate itinerary creation but must use structured tool/data outputs rather than inventing local availability.

## 16. ATLAS Assistant integration

Assistant intents include:

- `discover.search_places`
- `discover.filter_places`
- `discover.find_deals`
- `discover.build_itinerary`
- `discover.modify_itinerary`
- `discover.explain_place`
- `discover.concierge_recommend`
- `discover.start_directions`
- `discover.request_ride`
- `discover.redeem_offer`

Permission and integration checks occur before any action.

Assistant responses must distinguish:

- organic recommendation;
- sponsored result;
- verified offer;
- stale/unverified information;
- external handoff.

## 17. Ride integration

When ATLAS Ride is available and authorized, Discover may pass:

- destination location;
- pickup context supplied or approved by the user;
- party size where supported;
- accessibility needs where supported;
- campaign attribution reference when lawful.

Discover must not claim a ride is booked until the Ride subsystem confirms it.

## 18. Pay integration

When ATLAS Pay is available and authorized, supported commerce may include:

- offer purchase;
- ticket/merchant checkout integration;
- hotel/partner campaign billing;
- commission settlement;
- partner invoice/payment references.

Discover must not store raw payment credentials.

Payment state must derive from ATLAS Pay or the authorized payment processor source of truth.

## 19. CRM integration

Hospitality Partner records may link to ATLAS CRM for:

- merchant acquisition;
- hotel/property accounts;
- contacts;
- campaign sales pipeline;
- onboarding tasks;
- partner support history.

CRM remains the relationship source of truth where enabled; Discover stores only references necessary for product operation.

## 20. Creator Studio integration

Creator Studio may generate:

- campaign creatives;
- offer cards;
- QR posters;
- social media assets;
- hotel concierge signage;
- partner onboarding collateral.

Only authorized media assets may be used. Generated creative must not imply third-party endorsements or rights that do not exist.

## 21. Accounting and revenue model

When monetization is enabled, supported revenue concepts may include:

- sponsored placement fees;
- subscription/partner plan fees;
- lead or referral fees where legally/contractually permitted;
- redemption commissions;
- campaign service fees;
- hotel concierge SaaS fees.

Accounting integration should post normalized business events, not duplicate the general ledger.

Example event categories:

- campaign_invoice_created;
- campaign_payment_received;
- redemption_commission_accrued;
- partner_credit_issued;
- referral_fee_accrued.

No revenue metric is displayed unless backed by recorded transactions/events.

## 22. Attribution model

Attribution events may include:

- impression;
- sponsored_impression;
- place_opened;
- external_website_clicked;
- phone_clicked;
- directions_started;
- place_saved;
- offer_viewed;
- offer_redeemed;
- itinerary_added;
- ride_handoff;
- payment_handoff;
- booking_handoff.

Each event should contain the minimum necessary context:

- event id;
- timestamp;
- place/offer/campaign reference;
- property context when applicable;
- anonymous/session/user reference as permitted;
- source surface;
- attribution touch reference;
- consent/privacy metadata where required.

Analytics must distinguish observed outcomes from inferred outcomes.

## 23. Permissions

Initial permission vocabulary:

Visitor/consumer:

- `hospitality.discover.read`
- `hospitality.discover.save`
- `hospitality.discover.itinerary.manage`
- `hospitality.offer.redeem`

Partner:

- `hospitality.partner.read`
- `hospitality.partner.manage`
- `hospitality.place.manage`
- `hospitality.offer.manage`
- `hospitality.campaign.manage`
- `hospitality.analytics.read`

Admin/reviewer:

- `hospitality.partner.verify`
- `hospitality.content.review`
- `hospitality.offer.review`
- `hospitality.campaign.review`
- `hospitality.provenance.review`

Permissions should be evaluated through the canonical ATLAS identity/authorization boundary, not permanently hard-coded to role names.

## 24. Multi-tenant and public-catalog behavior

Partner-owned content must always be tenant/org scoped.

Public discovery records require an explicit ownership/source model. They must not become globally writable merely because they are publicly readable.

Recommended separation:

- catalog records: curated/publicly readable through governed API;
- partner overlays: org-scoped writable claims linked to catalog records;
- private analytics/campaign/billing data: strictly org-scoped;
- property concierge configuration: hotel/property-scoped;
- user saves/itineraries: user/org scoped according to product mode.

## 25. Privacy

The subsystem should minimize collection of visitor data.

Do not require account creation for basic public browsing unless product security needs change.

Precise location:

- requires user permission;
- should be used transiently where possible;
- should not be stored indefinitely by default;
- analytics should prefer coarse geography when exact location is unnecessary.

Guest/hotel identity, reservations, room numbers, and stay data are separate sensitive contexts and require explicit authorized integration and purpose.

## 26. Accessibility

Required accessibility direction:

- keyboard-operable map/list fallback;
- screen-reader accessible place and filter content;
- non-map list alternative for geographic results;
- sufficient contrast and visible focus;
- semantic labels for sponsored content;
- accessible offer terms;
- captions/text alternatives for partner media where relevant;
- support for ATLAS multimodal accessibility patterns.

Map-only interaction is not acceptable as the sole access path.

## 27. Internationalization

UI architecture should support locale files rather than hard-coded multilingual strings.

Initial product locales:

- English (`en`);
- Spanish (`es`);
- Portuguese (`pt`).

Partner-supplied descriptions remain source-language content unless translations are supplied or generated through an approved translation workflow with provenance.

## 28. Error model

Normalized error categories:

- `authentication_required`
- `authorization_denied`
- `organization_mismatch`
- `partner_not_verified`
- `place_not_found`
- `location_not_found`
- `offer_not_found`
- `offer_inactive`
- `offer_expired`
- `offer_limit_reached`
- `redemption_rejected`
- `campaign_not_active`
- `source_unavailable`
- `source_stale`
- `map_provider_unavailable`
- `routing_provider_unavailable`
- `ride_unavailable`
- `pay_unavailable`
- `persistence_failed`
- `audit_failed`

Errors must not leak provider secrets, internal tokens, private customer data, or raw upstream credentials.

## 29. Empty and degraded states

Examples:

- no places in current area;
- no verified deals available;
- location permission denied;
- map provider not configured;
- external hours source stale;
- partner awaiting verification;
- campaign awaiting review;
- no attribution data yet;
- Ride unavailable;
- Pay unavailable.

The UI must state the real condition rather than fabricate sample metrics or fake availability.

## 30. Security controls

- Validate and normalize external URLs.
- Sanitize partner-authored rich text.
- Restrict media uploads by type, size, and approved storage path.
- Protect write operations through authenticated server-side endpoints.
- Apply RLS to org-scoped tables.
- Rate-limit public search and redemption endpoints as appropriate.
- Prevent predictable redemption abuse.
- Audit partner verification, campaign approval, offer lifecycle changes, and manual overrides.
- Never commit API keys, map tokens, merchant secrets, payment secrets, or private source credentials.
- Keep privileged source/provider credentials server-side.

## 31. Abuse and fraud controls

Offer/redemption system should consider:

- per-user/session/device limits where lawful;
- rate limiting;
- signed one-time or time-limited redemption references when needed;
- partner-side confirmation workflows;
- suspicious repeated redemption detection;
- campaign click/impression deduplication;
- invalid attribution filtering;
- admin review of abuse signals.

No invasive fingerprinting is introduced without separate privacy review.

## 32. API surface

Normalized Edge Function operations may include:

Public/read:

- `searchPlaces`
- `getPlace`
- `listCategories`
- `listRegions`
- `listActiveOffers`
- `getOffer`
- `buildItinerary`
- `getConciergeContext`

Authenticated consumer:

- `savePlace`
- `unsavePlace`
- `saveItinerary`
- `redeemOffer`

Partner:

- `upsertPlace`
- `upsertLocation`
- `createOffer`
- `updateOffer`
- `createCampaign`
- `updateCampaign`
- `getPartnerAnalytics`

Admin/reviewer:

- `verifyPartner`
- `reviewPlace`
- `reviewOffer`
- `reviewCampaign`
- `resolveSourceConflict`

Each operation must enforce its own authorization and scope.

## 33. Search implementation direction

Initial implementation should prefer existing Postgres/Supabase capabilities before adding a dedicated search service.

Possible first-phase mechanisms:

- normalized text columns;
- PostgreSQL full-text search;
- trigram similarity if already available/approved;
- PostGIS for geospatial filters if available/approved;
- structured filters;
- deterministic server-side ranking.

A dedicated external search engine should be added only when measured requirements justify it.

## 34. Geospatial model

If PostGIS is available and compatible with the existing Supabase project, locations should support indexed geography/geometry points for:

- radius search;
- bounding box search;
- nearest-place lookup;
- region assignment assistance.

Distance displayed to users must be calculated from a real geospatial function/provider and must distinguish straight-line distance from route distance.

## 35. External provider adapters

External services should use adapters:

- map tiles/rendering;
- geocoding;
- routing/directions;
- place/source ingestion;
- booking;
- events;
- transport;
- payment;
- email/notifications.

Each adapter must expose truthful readiness and fail closed when configuration is unavailable.

## 36. Testing strategy

### Unit tests

- place/category/region normalization;
- organic ranking excludes sponsorship weight;
- sponsored labeling rules;
- offer validity/eligibility rules;
- redemption limit checks;
- permission checks;
- provenance/freshness state transitions;
- itinerary constraint handling;
- attribution event normalization;
- high-stakes category sponsorship exclusion.

### Integration tests

- public catalog read isolation;
- partner org isolation;
- partner write permissions;
- source ingestion update semantics;
- geospatial filter correctness;
- offer creation/update/review lifecycle;
- redemption transaction and deduplication;
- campaign review/activation lifecycle;
- analytics aggregation from real event fixtures;
- Assistant structured tool contract;
- Ride/Pay fail-closed behavior when unavailable.

### UI tests

- visitor map/list synchronization;
- search and filters;
- place details;
- active/inactive deal states;
- itinerary creation/editing;
- concierge context;
- partner CRUD flows;
- campaign labeling;
- responsive desktop/tablet/mobile behavior;
- accessibility keyboard and screen-reader critical paths;
- loading/empty/error/success/degraded states.

### Security tests

- cross-org access denied;
- unverified partner cannot publish restricted content;
- unauthorized campaign approval denied;
- malformed external URLs rejected;
- XSS-safe partner text rendering;
- redemption replay controls;
- no secret leakage in API responses/logs;
- public API rate-limit behavior where implemented.

## 37. Rollout order

1. Establish domain package and permission vocabulary.
2. Add source/provenance, category, region, place, and location schema with RLS.
3. Implement server-side read/search API with empty-state-safe UI.
4. Add map adapter and synchronized map/list experience.
5. Add partner model and governed partner CRUD.
6. Add offers and redemption lifecycle.
7. Add hotel concierge context and QR/deep-link support.
8. Add campaign/sponsored placement model with labeling and review gates.
9. Add attribution event pipeline and partner analytics.
10. Add structured itinerary engine and ATLAS Assistant intents.
11. Integrate Creator Studio, CRM, Ride, Pay, and Accounting only at verified capability boundaries.
12. Run full typecheck, unit/integration/security/UI tests, build, and route verification.
13. Deploy through ATLAS Manager gates only after repository verification passes.
14. Verify public production behavior separately from build success.

## 38. Initial Orlando pilot

The first destination taxonomy can be Orlando/Central Florida because it provides dense real-world coverage across attractions, hotels, dining, shopping, nightlife, airports, transportation, and destination operators.

The pilot should not hard-code Orlando-specific business logic into the domain. Orlando is seed geography; the architecture remains destination-agnostic.

Suggested pilot regions:

- International Drive;
- Universal area;
- Disney/Lake Buena Vista;
- Downtown Orlando/Winter Park;
- Orlando International Airport area;
- Kissimmee;
- St. Cloud.

Initial catalog data must come from permitted sources and retain provenance.

## 39. Production truth model

Track separately:

- code implemented;
- schema applied;
- Edge Function deployed;
- provider configured;
- provider verified;
- data source verified;
- route reachable;
- public edge serving expected build;
- campaign active;
- offer active;
- analytics event observed.

No UI may collapse these states into a generic `Live` label.

## 40. Definition of done

This milestone is complete only when:

- Discover exists as a real Hospitality subsystem rather than a static mockup;
- visitor routes function on desktop, tablet, and mobile;
- places, locations, categories, and regions come from persisted governed data;
- provenance and freshness are represented;
- search/filter/map interactions work;
- partner CRUD is tenant-scoped and authorized;
- offers have a real lifecycle and redemption model;
- sponsored results are clearly labeled and separated from organic ranking;
- hotel concierge context is isolated from room-access authorization;
- itinerary generation consumes structured real data;
- analytics distinguishes observed and inferred outcomes;
- no production metric is fabricated;
- unavailable providers fail closed;
- accessibility critical paths are verified;
- typecheck, appropriate test suites, build, and affected-route checks pass;
- no secrets are committed;
- deployment state is reported separately from source validation;
- public production is not claimed verified until the deployed build is checked at the ATLAS public edge.

## 41. Future extensions

Future approved milestones may add:

- ticketing and reservation adapters;
- event inventory;
- loyalty and rewards;
- destination passes;
- merchant POS redemption confirmation;
- richer personalization;
- voice concierge through ATLAS Voice;
- wearable/accessibility concierge surfaces;
- partner marketplace settlement;
- cross-destination travel planning;
- additional locales;
- hotel PMS guest-context integration with explicit consent and authorization.

Each extension must reuse this domain and preserve the separation between public discovery/local commerce and privileged hotel access-control operations.
