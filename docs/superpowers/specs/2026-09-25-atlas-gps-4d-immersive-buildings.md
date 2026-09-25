# ATLAS GPS 4D — Immersive Streets & Indoor Navigation

Date: 2026-09-25
Canonical route: `/gps`
Status: implementation started
Production policy: fail-closed

## Goal

Extend ATLAS GPS 4D from conventional street/satellite/terrain navigation into a provider-neutral spatial runtime capable of:

- street-level navigation;
- realistic 3D city/building context;
- optional panoramic street imagery;
- controlled transition from outdoor navigation into an authorized indoor model;
- floor-aware routing through entrances, corridors, stairs, elevators, escalators, rooms and POIs;
- tenant-owned 3D scans/BIM/3D Tiles without forcing a paid global provider.

## Provider model

ATLAS must not make Google, Cesium ion, Mapillary, or any other third party a hard runtime dependency.

Default zero-cost path:
- existing MapLibre/OpenStreetMap-compatible street map;
- existing USGS imagery in the U.S.;
- existing terrain path;
- OpenStreetMap Simple Indoor Tagging where building-specific data exists;
- tenant-owned indoor models or scans.

Optional realism adapters:
- Google Maps Platform Photorealistic 3D Tiles;
- Google Street View / Street View Tiles;
- CesiumJS or Cesium for Unity as a 3D Tiles renderer;
- tenant-provided 3D Tiles, GLB, BIM-derived models or 360 panoramas.

Any provider that needs credentials, billing, a token, or a separate license remains `external-gated` until configured and verified.

## Outdoor → indoor transition

ATLAS may offer an Enter Building action only when all of these are true:

1. the destination resolves to a known building;
2. an authorized indoor source exists for that exact building;
3. the indoor graph contains at least one entrance;
4. level references are valid;
5. every routed edge references an existing node;
6. tenant-private floor plans are organization-scoped;
7. the UI identifies the indoor source and never fabricates missing rooms or levels.

A photorealistic exterior mesh by itself does not prove that indoor geometry exists.

## Indoor coordinate model

Outdoor navigation continues in WGS84 latitude/longitude.

Indoor navigation uses a local metric frame:
- `x_m`
- `y_m`
- `z_m`
- `level`

The building owns the transform between the local frame and its geodetic anchor. This avoids pretending that consumer GPS is precise enough to identify an interior room.

## Routing

The first implementation uses a deterministic graph for:
- entrance;
- corridor;
- room;
- stairs;
- elevator;
- escalator;
- POI.

The graph can later be generated from:
- OpenStreetMap Simple Indoor Tagging;
- IFC/BIM;
- CAD;
- LiDAR/photogrammetry;
- authorized floor plans;
- ATLAS CleanScan 3D.

Accessibility routing is a separate constraint and must not infer accessibility when metadata is absent.

## Renderer architecture

```text
ATLAS GPS session
  -> outdoor provider adapter
     -> MapLibre open map/terrain
     -> optional Photorealistic 3D Tiles
     -> optional street panorama
  -> building resolver
  -> indoor-source gate
  -> building-local graph
  -> floor selector
  -> indoor renderer
     -> 2D floor geometry
     -> optional GLB / 3D Tiles / scan
  -> route overlay
  -> voice / AR guidance
```

## Truthful readiness

- Open 3D: available.
- Photorealistic 3D: external-gated until credentials/provider policy pass.
- Street panorama: external-gated until an authorized imagery provider is configured.
- OSM indoor: external-gated and building-specific.
- ATLAS/tenant indoor: available only for data the tenant owns or is authorized to use.
- Indoor positioning: not claimed from browser GPS alone. BLE/UWB/Wi-Fi RTT/visual positioning require separate adapters and device validation.

## First implementation slice

This branch adds:

- `immersiveSpatial.ts` provider-neutral spatial contracts;
- fail-closed mode resolution;
- indoor building/level/node domain types;
- structural indoor validation;
- deterministic cross-floor graph routing;
- unit tests proving that missing photorealistic or indoor providers never become falsely ready.

Next integration slice:
- expose readiness from the authenticated `atlas-gps` edge boundary;
- add an Immersive control to `Gps4DPage`;
- add CesiumJS/3D Tiles renderer behind a provider gate;
- add OSM indoor/tenant indoor adapters;
- add an Enter Building transition and floor selector;
- add organization-scoped persistence for private indoor maps;
- verify desktop/mobile performance and production CSP.
