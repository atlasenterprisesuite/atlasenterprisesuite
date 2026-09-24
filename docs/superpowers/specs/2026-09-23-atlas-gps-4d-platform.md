# ATLAS GPS 4D — Navigation & Spatial Intelligence

Date: 2026-09-23
Canonical route: `/gps`
Security boundary: ATLAS Identity + Supabase organization membership + RLS
Production policy: fail-closed

## Objective

Evolve the recovered Orlando GPS prototype into a governed ATLAS mobility surface that can support navigation, Ride, fleet, commerce and spatial intelligence without presenting unauthenticated external data as an ATLAS-owned live provider.

## Architecture

Browser:
- MapLibre GL JS pinned to 6.11.1 behind a scoped CSP allowlist.
- Browser Geolocation restricted to same-origin pages.
- Street view mode: OpenFreeMap/OpenStreetMap style.
- Satellite mode: USGS The National Map ImageryOnly, United States coverage.
- 3D mode: USGS imagery draped over Mapterhorn terrain with MapLibre terrain/globe.
- SpeechSynthesis for zero-cost voice instructions.

ATLAS backend:
- `atlas-gps` authenticated Supabase Edge Function.
- Active organization membership required for every operation.
- Nominatim and OSRM calls occur server-side, not directly from the browser.
- Nominatim calls are cached and throttled app-wide to at least one second between upstream requests.
- OSRM route responses are cached and normalized into routes, steps and lane evidence.
- Saved places are organization/user scoped in Supabase with RLS.

Navigation:
- route alternatives;
- distance and ETA;
- turn-by-turn step model;
- lane evidence when supplied by the route engine;
- GPS accuracy, speed and heading;
- route progress;
- deviation measurement;
- automatic rerouting after a bounded deviation threshold and cooldown;
- Spanish browser voice guidance.

## Truthful capability boundaries

Implemented or usable with explicit provenance:
- browser GPS;
- street maps;
- U.S. satellite/aerial imagery;
- 3D terrain/globe;
- geocoding;
- driving routing;
- route alternatives;
- turn-by-turn;
- lane evidence;
- automatic rerouting;
- voice guidance;
- durable saved places.

External-gated:
- OpenFreeMap/OpenStreetMap;
- Mapterhorn;
- Nominatim;
- OSRM.

Blocked until an authoritative adapter exists:
- live traffic;
- live incidents/closures;
- street-level imagery;
- realtime public transit;
- bulk offline world tiles.

No blocked capability may be rendered as connected/live/verified. No external-gated provider is treated as SLA-backed ATLAS infrastructure.

## Future provider adapters

The provider-neutral boundary allows later replacement with:
- self-hosted OpenStreetMap/PMTiles;
- self-hosted OSRM/Valhalla/GraphHopper;
- OpenTripPlanner + GTFS/GTFS-RT;
- authorized traffic/incident providers;
- authorized street-level imagery providers;
- aviation/weather/spatial layers with authoritative sources.

The UI and persistence contracts must remain stable when providers change.

## Production verification

`/gps` is part of the canonical fail-closed global production route contract. A deployment cannot be marked production-verified if the route is missing or fails the production verification contract.
