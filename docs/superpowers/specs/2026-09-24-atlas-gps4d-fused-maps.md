# ATLAS GPS 4D — Fused Maps Experience

Date: 2026-09-24
Canonical route: /gps

## Product direction

ATLAS GPS 4D combines the strongest interaction patterns expected from modern navigation products while preserving an independent ATLAS visual system and governed provider boundaries.

Implemented in this phase:
- Street map uses the supported OpenFreeMap Liberty style.
- Map engine health and external layer health are reported independently.
- Satellite and 3D remain independent selectable layers.
- Mobile renders the map before the long navigation panel.
- Search results can become a destination or an intermediate stop.
- Multi-stop journeys are assembled from governed ATLAS routing legs.
- Route alternatives expose duration/distance tradeoffs without inventing traffic.
- Native Web Share / clipboard sharing creates an ATLAS GPS destination link.
- Shared destination links restore coordinates on open.
- Arrival cues distinguish approaching from arrived.
- Existing voice, lane evidence, rerouting, saved places, satellite and 3D remain active.

## Inspiration boundary

The experience takes inspiration from generally available navigation capabilities such as:
- route alternatives and immersive navigation;
- lane and voice guidance;
- detailed 3D/satellite exploration;
- multi-stop planning;
- place discovery and saved locations;
- destination arrival context.

ATLAS does not copy proprietary UI, imagery, code, logos, trade dress or closed provider data from Google Maps or Apple Maps.

## Fail-closed capabilities

The following remain blocked until an authoritative or licensed adapter exists:
- realtime traffic;
- realtime incidents and closures;
- street-level / Look Around style imagery;
- realtime transit;
- camera/speed-enforcement data;
- global offline tile packages.

Blocked features must never be shown as connected, live, verified or authoritative.

## Mobile requirement

At widths <= 900px the map is first, navigation panel second. A layer outage must not replace the map engine with a false global-error state when another layer remains usable.
