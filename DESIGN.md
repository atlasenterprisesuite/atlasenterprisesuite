# ATLAS Design Intelligence

This file is the canonical, agent-readable visual product contract for ATLAS Enterprise Suite.

## Operating rule

Before creating a new visual asset, component, route, layout, token, or interaction pattern:

1. search the repository for an existing ATLAS equivalent;
2. reuse or extend the existing implementation when it satisfies the requirement;
3. introduce a new primitive only when reuse would create a functional or accessibility regression;
4. never substitute a screenshot or static mockup for a functional interface.

Visual work follows:

`LIBRARY -> ANALYSIS -> CLASSIFICATION -> ARCHITECTURE -> COMPONENT -> ROUTE -> DATA/PERMISSIONS -> STATES -> RESPONSIVE -> ACCESSIBILITY -> TESTS -> CI -> DEPLOY -> VERIFY`

## Canonical design sources

- Design contract: `DESIGN.md`
- Design tokens: `apps/web/src/atlas-design-tokens.css`
- Existing global UI: `apps/web/src/styles.css`
- Accessibility behavior: `apps/web/src/accessibility.css`
- Shared shell: `apps/web/src/components/AtlasShell.tsx`

Do not create a second token source of truth.

## Product identity

ATLAS is an enterprise operating system. Interfaces should be dense enough for operational work but remain legible, calm, and predictable.

The visual language is:
- deep spatial surfaces rather than flat black panels;
- cyan/blue primary accents with violet reserved for dimensional emphasis;
- restrained glass effects;
- clear hierarchy through spacing, typography, and luminance rather than decoration;
- status colors used semantically, never as decoration;
- data-first layouts with usable empty, loading, error, disabled, selected, and success states.

## Tokens

New shared UI must consume the `--atlas-*` variables from `atlas-design-tokens.css` instead of introducing duplicated literals for core color, radius, spacing, shadow, typography, focus, and motion values.

Legacy styles may be migrated incrementally. New code must not expand visual drift.

## Interaction states

Any interactive component that can reach production must implement the applicable states:

- default
- hover
- focus-visible
- active/selected
- loading
- disabled
- empty
- error
- success

A visible control must perform a real action or navigation supported by the current architecture. No `href="#"`, console-only actions, fake connection states, or unsupported "Coming Soon" placeholders.

## Responsive behavior

Every shared component must remain usable at:
- mobile: 320px and above;
- tablet: 768px and above;
- desktop: 1024px and above;
- wide enterprise desktop: 1440px and above.

Prefer fluid layout primitives, `minmax()`, `clamp()`, and content-driven wrapping over fixed canvas dimensions.

## Accessibility

Target WCAG 2.2 AA.

Required:
- keyboard-reachable controls;
- visible focus;
- semantic HTML first;
- labels or accessible names for controls;
- sufficient contrast;
- reduced-motion support;
- no information conveyed only by color;
- compatibility with the existing ATLAS accessibility profile and communication settings.

## Truthful state policy

Never label a provider, payment, signature, shipment, integration, health check, deployment, or external capability as connected, approved, paid, signed, shipped, fulfilled, healthy, or production verified without authenticated evidence from the corresponding source.

Unknown state is rendered as unknown, verifying, unavailable, or evidence-needed.

## Dashboard rule

The main dashboard is a control surface, not a marketing landing page. It should prioritize:
1. organization/session context;
2. command/search/navigation;
3. operational status grounded in real data;
4. actionable modules;
5. recent or pending work;
6. accessibility and assistant access.

## Agent behavior

Agents may choose implementation details autonomously within this contract, but must preserve:
- tenant boundaries;
- RBAC;
- auditability;
- real data semantics;
- production/development separation;
- current working functionality.

When a visual reference conflicts with verified ATLAS functionality, preserve the verified functionality and adapt the visual treatment around it.

## Completion gate

Visual work is not complete until the affected scope has evidence for:

`CODE -> DESIGN -> RESPONSIVE -> ACCESSIBILITY -> SECURITY/RBAC -> TESTS -> BUILD -> DEPLOY -> PRODUCTION VERIFY`

If deployment or production evidence is unavailable, stop the claim at the last verified gate.
