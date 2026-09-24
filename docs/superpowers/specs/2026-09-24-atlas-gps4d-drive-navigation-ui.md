# ATLAS GPS 4D — Drive Navigation UI

Date: 2026-09-24
Canonical route: `/gps`

## Goal

Implement the approved ATLAS navigation composition with a road-oriented drive view above a route overview, while keeping the product truthful about data provenance.

## Navigation composition

When navigation is active:

1. **ATLAS Drive View**
   - MapLibre vector map rendered at high zoom with ~72° pitch.
   - Camera follows browser GPS and device heading.
   - Active route rendered with a cyan core and violet glow.
   - Vehicle marker rotates with heading.
   - Speed and heading HUD.
   - Voice toggle.
   - Street-level imagery control remains disabled until an authorized provider exists.

2. **Route Overview**
   - Flat north-up map underneath the drive view.
   - Same canonical route geometry.
   - Route remains readable independently of the drive camera.
   - Existing layer health, arrival state, satellite and 3D infrastructure remain available.

3. **Maneuver Card**
   - Maneuver symbol.
   - Distance to current step.
   - Spoken instruction text.
   - Lane evidence when upstream routing supplies it.
   - Remaining ETA / distance.
   - Explicit End navigation action.

## Mobile behavior

At narrow widths, the navigation surface occupies the viewport with approximately 42% Drive View and 58% route overview. Setup controls, metrics panel and capability registry are hidden while active navigation is in progress and return after navigation ends.

## Provider boundary

This feature does **not** claim Google Street View, Apple Look Around or any proprietary street-level imagery. The top panel is a real MapLibre vector drive view using the same ATLAS route/GPS state. Street-level photographic imagery remains `BLOCKED` until an authorized provider adapter is implemented.

No Google/Apple proprietary code, UI assets, logos or closed imagery are included.
