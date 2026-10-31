# ATLAS GPS 5D — Orlando expansion

## Objective
Expand International Drive pilot to Orlando using public geographic datasets, without pretending a complete photorealistic twin exists.

## Sources and licensing
- OpenStreetMap: roads, POIs, buildings and addresses where mapped; ODbL attribution and share-alike assessment for derivative databases.
- City of Orlando / Orange County GIS: evaluate available official address, parcel, building and road datasets; record license and update timestamp before ingestion.
- USGS 3DEP: terrain/elevation where appropriate.
- Public aerial imagery: use only under documented license, no scraping proprietary basemaps.
- Mapillary: optional street imagery only through authorized APIs and permitted display.

## Pipeline
1. Define polygon of Orlando city limits from authoritative GIS; never confuse with metro area.
2. Fetch OSM data in bounded tiles, incremental updates, caching and backoff; no unrestricted Overpass mass extraction.
3. Normalize POI/address/building features to a geospatial schema with source, license, observed_at, geometry accuracy and confidence.
4. Deduplicate by source IDs and spatial/name matching; preserve provenance and review uncertain merges.
5. Render 2D first, then Cesium 3D terrain/building footprints; add verified imagery only.
6. Routing requires graph/provider validation, turn restrictions and accessible-route evidence.
7. Public UI: search, category filters, selectable buildings, clear imagery availability indicators, fallback to 2D.

## Data protection and cost
Public geography is distinct from private user GPS tracks. Location permissions opt-in; minimize retention. Provider quotas, rate limits and costs require gates.

## P0 acceptance
Automated tests for malformed coordinates, duplicates, attribution, provider outage, missing imagery, tenant isolation, accessibility; mobile E2E; CI exact SHA; verified production release. Until then NO-GO.

## Demo first
Use docs/pilots/gps5d-international-drive-demo.html for bounded public demonstration. The current demo does not certify complete city coverage, 3D, or navigation.
