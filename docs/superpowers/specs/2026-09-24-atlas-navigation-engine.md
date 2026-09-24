# ATLAS Navigation Engine — Core Architecture

Date: 2026-09-24
Canonical surface: `/gps`

## Problem

A production HTTP 200 for `/gps` proves deployment only. It does not prove that navigation works. The previous implementation coupled browser GPS samples directly to React presentation state and advanced maneuvers mostly by proximity to one step location.

## New engine boundary

`NavigationLocationSource → AtlasNavigationEngine → Navigation Session/UI`

### Location sources

1. **Apple native bridge**
   - Core Location
   - `kCLLocationAccuracyBestForNavigation`
   - automotive navigation activity
   - course, speed, horizontal accuracy and timestamp
   - intended for a future ATLAS iOS host

2. **Browser fallback**
   - `navigator.geolocation.watchPosition`
   - high accuracy
   - zero maximum-age cache
   - explicit permission/error states

The React page no longer owns the raw geolocation watcher.

### Navigation engine

The engine:
- filters noisy fixes;
- derives course from movement when device heading is absent;
- projects a high-confidence fix onto the active route geometry;
- keeps poor-accuracy fixes unsnapped;
- computes along-route progress and remaining distance;
- advances maneuver state from route progress, not one proximity hit;
- requires repeated, accuracy-aware off-route evidence before rerouting;
- detects arrival from route-end proximity/progress;
- exposes confidence and source metadata to the UI.

This is route-relative map matching. It is not claimed as full road-network matching. Full road-network matching belongs behind a governed routing backend such as self-hosted Valhalla/OSRM/GraphHopper.

### Session behavior

During active navigation:
- display/camera follows the engine's display fix;
- vehicle rotation uses native course/device heading or movement-derived course;
- voice follows the engine-selected maneuver;
- reroute is requested only after confirmed deviation;
- Screen Wake Lock is requested when supported and released at navigation end.

## Provider boundary

Current routing/geocoding defaults remain external-gated:
- OSRM public demo fallback;
- Nominatim public fallback.

These are not SLA-backed production navigation infrastructure. A future cutover must replace them with governed/self-hosted services before ATLAS claims Google/Apple-class routing reliability.

## Proprietary boundary

No Google Maps or Apple Maps proprietary code, assets, imagery, private APIs or trade dress are copied. ATLAS implements comparable general navigation concepts through its own engine and open/native platform primitives.
