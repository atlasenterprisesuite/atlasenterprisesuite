# ATLAS Home + Command Center Separation Design

Date: 2026-10-05
Status: Approved

## Objective

Separate ATLAS discovery/navigation from technical system observability so the first screen feels like a premium product home rather than a dense operations dashboard, while preserving the existing dashboard as a dedicated Command Center/System Overview surface.

## Product model

- **Home** = discover + enter + continue.
- **Command Center** = operate.
- **System Overview** = observe health, readiness, integrations, and operational state.
- **Module Cover** = establish context before entering a module workspace.
- **Module Workspace** = execute real work.

## Home experience

The existing approved sunset image remains the full-screen visual asset and must be reused. No replacement image is generated.

The Home must keep:
- ATLAS identity and dark/cyan visual language;
- the current universal search/command input;
- canonical quick access routes;
- responsive desktop/tablet/mobile behavior;
- reduced-motion support.

The Home should prioritize:
1. ATLAS brand and universal command/search.
2. Primary category covers for Enterprise, AI, Finance, Network, Spatial, Health, Business, Creator, Security, and Cloud when canonical routes exist.
3. Continue / Recent / Pinned style navigation derived from the canonical module registry rather than duplicated hard-coded module definitions.
4. One concise system-health strip instead of a full technical dashboard.
5. A clear action to open the dedicated Command Center.

## Command Center experience

The current metrics, readiness chart, operational feed, spatial module explorer, and system-oriented information remain available but move below a dedicated Command Center heading/surface. They are no longer presented as the primary ATLAS Home experience.

The Command Center must preserve:
- total module count;
- implemented, partial, and external-gated readiness counts;
- operational module feed;
- link to all modules;
- readiness visualization;
- multidirectional module navigation;
- existing canonical routes.

## Information hierarchy

The first viewport must not expose the complete system architecture at once. It should communicate what ATLAS is, provide the fastest entry points, and allow the user to continue work quickly.

Technical readiness language is secondary and should use compact status copy such as:

`System healthy · <implemented> operational · <gated> integrations · <actions> actions required`

Where an exact live health percentage or action count is not backed by a canonical source, the UI must not fabricate one. It should use truthful registry-derived counts only.

## Accessibility and states

- Maintain semantic landmarks and accessible labels.
- Search empty and no-match states remain visible through an ARIA live region.
- Keyboard navigation remains supported.
- Focus-visible states must remain clear.
- Reduced-motion preference disables decorative motion.
- Text contrast must remain legible over the photographic background.

## Architecture

Continue using `ATLAS_MODULES` as the canonical registry. Derive Home category covers, recent modules, readiness counts, and operational feed from registry data wherever possible.

Avoid introducing a second module registry. Small presentation metadata may live in the Home component only where no canonical registry field exists.

## Non-goals

- No backend schema changes.
- No new image generation.
- No fake realtime telemetry.
- No removal of the existing Command Center capabilities.
- No placeholder links or `href="#"` interactions.

## Acceptance criteria

1. The Home first viewport exposes a concise visual navigation experience rather than the four-card technical metrics dashboard.
2. The Home includes canonical category covers and a concise registry-derived system status strip.
3. A visible action opens/scrolls to the Command Center.
4. The Command Center retains the existing readiness metrics and operational information.
5. Search continues routing to canonical module destinations.
6. Existing sunset asset remains local and reused.
7. Unit tests cover the Home/Command Center separation and canonical routes.
8. CI, accessibility, build, and production-readiness checks pass before merge.
9. Production verification is fail-closed for existing P0 routes.