# ATLAS ASTRA-Derived Module Experience Design

Date: 2026-09-15
Status: Approved by user direction
Repository: `atlasenterprisesuite/atlasenterprisesuite`
Reference: user-provided GPT-6 ASTRA Wix site and screen recordings

## Purpose

Apply the approved GPT-6 ASTRA website presentation language to the existing ATLAS Enterprise Suite without creating a parallel app and without replacing functional module workflows.

## Scope for this implementation slice

1. Create one reusable cinematic module-overview component for existing ATLAS module landing pages.
2. Apply it to the current Enterprise, Finance and Accounting landing surfaces.
3. Apply the same visual grammar to the existing CRM home while preserving provider connection state and live-data truthfulness.
4. Keep every existing deep route, identity guard, tenant boundary, RBAC behavior and data source unchanged.
5. Do not touch or recreate Floot CI endpoints (`ci-start`, `runAtlasCi`, `atlasCiTarget`, `ci-probe`).

## Visual grammar

- Near-black background with cyan primary accents and restrained orange highlights.
- Large editorial typography and high vertical rhythm, inspired by the approved ASTRA reference.
- Sections progress from purpose/architecture to capabilities, execution, integrations, governance and final action.
- No decorative screenshot may substitute for software.
- No fabricated metrics, provider status, revenue, counts or connectivity claims.

## Architecture

Introduce `ModuleExperiencePage` as a presentational component. Module-specific copy and destinations remain data passed by each existing module page. It renders a hero, optional action links, a sequence of capability sections and a status/governance note. Existing operational pages remain separate and unchanged.

## Navigation and truthfulness

- Active cards link only to routes that currently exist.
- Unavailable capabilities render as non-clickable gated cards with truthful status text.
- CRM connection state remains sourced from the existing `crmApi` path; the new presentation does not infer or invent provider readiness.
- Existing sidebar navigation remains the shell owner.

## Responsive behavior

Desktop uses wide editorial sections and multi-column capability cards. Tablet collapses to two columns. Mobile becomes a single column with horizontally safe navigation and touch-sized actions.

## Accessibility

- Semantic headings preserve one page-level `h1`.
- Navigation groups keep accessible labels.
- Gated cards expose `aria-disabled=true`.
- Focus-visible styling remains visible against the dark theme.
- Reduced-motion users do not depend on transforms/animation to understand state.

## Tests

Integration tests must prove the new experience renders on `/`, `/finance`, `/finance/accounting`, and `/crm` without breaking existing route destinations. Existing CRM live-status tests remain authoritative for provider behavior.
