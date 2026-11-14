# ORBIT OS data collector

Public-source harvester for **ORBIT OS**, the NASA Space Apps 2026 Space Intelligence Platform.

It pulls live data from keyless (or `DEMO_KEY`) endpoints, normalizes every record into a common schema, and writes JSON into `out/` so the app can load it into its database later. **It never fabricates observations.** If a source fails, the run continues and the failure is recorded in `out/manifest.json`.

This package does not modify the ORBIT OS app.

## Requirements

- Node.js 22+ (developed against Node 22/24)
- Network access to the public NASA, USGS, NOAA, and Celestrak endpoints

## Setup

```bash
cd data-collector
npm install
```

## Collect

```bash
npm run collect
```

Optional environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `NASA_API_KEY` | `DEMO_KEY` | Used only for NASA DONKI (`api.nasa.gov`). A personal key raises the rate limit; it does not restore a missing route. |

The command writes one JSON file per source plus `out/manifest.json`. Re-running replaces those files with a fresh harvest.

## Output

| File | Source | What is stored |
| --- | --- | --- |
| `out/eonet.json` | NASA EONET v3 | Open events merged with events from the last 30 days |
| `out/usgs-earthquakes.json` | USGS | M2.5+ earthquakes, past 30 days (GeoJSON feed) |
| `out/nasa-power.json` | NASA POWER | Daily `T2M`, `PRECTOTCORR`, `ALLSKY_SFC_SW_DWN` for 14 points over the last 5 years |
| `out/firms.json` | NASA FIRMS | Active-fire detections from keyless global 24h CSVs |
| `out/swpc.json` | NOAA SWPC | Official 3-hour Kp, 1-minute estimated Kp, and RTSW solar wind / IMF |
| `out/celestrak.json` | Celestrak | Active-satellite catalog **count** plus a deterministic sample of GP / TLE records |
| `out/donki.json` | NASA DONKI | CMEs (and solar flares when the `FLR` API is available) for the last 30 days |
| `out/gibs-layers.json` | NASA GIBS | WMTS layer manifest (MODIS true color, VIIRS, SST, snow/ice, NDVI) |
| `out/manifest.json` | collector | Per-source record counts, time ranges, status, notes, and errors |

See [schema.md](schema.md) for the record shape the app should ingest.

## POWER points

Four Norwegian sites plus ten global climate / disaster hotspots:

- Oslo, Tromsø, Svalbard (Longyearbyen), Bergen
- Amazon (Manaus), California (Los Angeles), Horn of Africa (Addis Ababa), South Asia (Dhaka), Siberia (Yakutsk), Greenland Summit, Australian Outback (Alice Springs), Sahel (Niamey), Great Barrier Reef, Congo Basin (Kisangani)

POWER dates are **local solar time** dates, not UTC instants. Missing observations (`-999`) are stored as `null`.

## FIRMS and MAP_KEY

A FIRMS `MAP_KEY` is **not required** when the public 24-hour NRT CSVs are reachable:

- `https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_Global_24h.csv`
- `https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_Global_24h.csv`
- `https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-21-viirs-c2/csv/J2_VIIRS_C2_Global_24h.csv`
- `https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Global_24h.csv`

Those endpoints were verified with live HTTP requests. If they ever go away or start requiring auth, the collector records the failure, skips FIRMS, and notes that a [MAP_KEY](https://firms.modaps.eosdis.nasa.gov/api/) is needed for the `/api/area/` and `/api/country/` APIs. The Suomi NPP 24h CSV has been observed as header-only (no detections) on some days; that is logged, not treated as invented data.

## Loading into ORBIT OS later

1. Run `npm run collect`.
2. Read `out/manifest.json` and skip any source whose `status` is `failed` or `skipped`.
3. For each remaining `file`, parse the JSON and insert `records[]` into the app database.
4. Every record already has `id`, `source`, `type`, `title`, `lat`, `lon`, `time`, `values`, `units`, `url`, `status: "live"`, and `retrieved_at`.
5. GIBS records are layer manifests (`type: "wmts-layer"`). Use `values.wmts_template` with `{Time}`, `{TileMatrixSet}`, `{TileMatrix}`, `{TileRow}`, `{TileCol}` on the globe.
6. Celestrak stores only a sample. The full catalog count is in `extra.catalog_count` (and the source notes).

## Honesty rules

- No synthetic earthquakes, fires, climate rows, CMEs, or satellites.
- A failed endpoint is an error in the manifest, not an empty success.
- Solar-wind 1-minute RTSW data is downsampled to real 5-minute observations (clock minute divisible by 5, plus the latest sample). That is a subset, not a model.
