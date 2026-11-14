# ORBIT OS collected-data schema

All observation files in `out/*.json` except `manifest.json` share the same envelope and record shape. The collector writes compact (single-line) JSON for the source files and pretty-printed JSON for the manifest.

## Source file envelope

```json
{
  "source": "usgs",
  "retrieved_at": "2026-11-14T13:10:00.000Z",
  "record_count": 2003,
  "time_range": {
    "start": "2026-10-15T12:04:11.000Z",
    "end": "2026-11-14T12:55:00.000Z"
  },
  "notes": ["optional human-readable notes about the harvest"],
  "extra": { "optional": "source-specific metadata" },
  "records": []
}
```

| Field | Type | Notes |
| --- | --- | --- |
| `source` | string | Stable source id (`eonet`, `usgs`, `nasa-power`, `firms`, `swpc`, `celestrak`, `donki`, `gibs`) |
| `retrieved_at` | string | ISO-8601 UTC timestamp when the file was written |
| `record_count` | number | Equals `records.length` |
| `time_range.start` / `end` | string or null | Min / max of record `time` values; null if none |
| `notes` | string[]? | Omitted when empty |
| `extra` | object? | Omitted when unused. Celestrak puts `catalog_count` here. |
| `records` | `LiveRecord[]` | Normalized observations or layer descriptors |

## LiveRecord

Every record has these fields:

```json
{
  "id": "string",
  "source": "usgs",
  "type": "earthquake",
  "title": "M2.7 - 22 km ESE of Naalehu, Hawaii",
  "lat": 19.01,
  "lon": -155.45,
  "time": "2026-11-14T12:08:46.140Z",
  "values": { "magnitude": 2.66, "depth_km": 33.1 },
  "units": { "magnitude": "Mw-equivalent", "depth_km": "km" },
  "url": "https://earthquake.usgs.gov/earthquakes/eventpage/...",
  "status": "live",
  "retrieved_at": "2026-11-14T13:10:00.000Z"
}
```

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `id` | string | yes | Stable enough to upsert. Prefer upstream ids (EONET id, USGS event id, DONKI activity id). |
| `source` | string | yes | Same as the file envelope `source` |
| `type` | string | yes | Source-specific kind (see below) |
| `title` | string | yes | Human-readable label for lists and popups |
| `lat` | number or null | yes | WGS84 latitude. Null when the feed has no geographic point (space weather, TLEs, WMTS layers). DONKI CME / flare coordinates are heliographic, not Earth lat/lon — still stored in `lat`/`lon` for convenience; check `units`. |
| `lon` | number or null | yes | WGS84 longitude (or heliographic longitude for DONKI) |
| `time` | string or null | yes | ISO-8601 instant when the source provides one. NASA POWER uses a `YYYY-MM-DD` local-solar-time date. GIBS uses the layer's default `{Time}` (usually a date). |
| `values` | object | yes | Measured or descriptive fields. Numbers may be `null` when the upstream fill value meant "missing". |
| `units` | object | yes | Map of `values` keys to unit strings. Empty object when not applicable. |
| `url` | string or null | yes | Canonical event or feed URL |
| `status` | `"live"` | yes | Always the literal `"live"` for records that came from a live request. Failed sources do not invent records with a fake status. |
| `retrieved_at` | string | yes | ISO-8601 UTC time of the HTTP harvest for this record |

Suggested SQL / document shape:

```sql
CREATE TABLE orbit_observations (
  id            TEXT PRIMARY KEY,
  source        TEXT NOT NULL,
  type          TEXT NOT NULL,
  title         TEXT NOT NULL,
  lat           DOUBLE PRECISION,
  lon           DOUBLE PRECISION,
  time          TEXT,
  values        JSONB NOT NULL,
  units         JSONB NOT NULL,
  url           TEXT,
  status        TEXT NOT NULL,
  retrieved_at  TIMESTAMPTZ NOT NULL
);
```

## Record `type` values

| source | type | meaning |
| --- | --- | --- |
| `eonet` | EONET category id, e.g. `wildfires`, `volcanoes`, `severeStorms` | Natural event |
| `usgs` | usually `earthquake` | Seismic event (USGS `properties.type`) |
| `nasa-power` | `daily-climate` | One location-day of T2M / PRECTOTCORR / ALLSKY_SFC_SW_DWN |
| `firms` | `active-fire` | One NRT fire detection |
| `swpc` | `kp-index` | Official 3-hour planetary Kp |
| `swpc` | `kp-index-estimated` | 1-minute estimated Kp |
| `swpc` | `solar-wind` | RTSW plasma (speed, density, temperature) |
| `swpc` | `solar-wind-imf` | RTSW interplanetary magnetic field |
| `celestrak` | `satellite-gp` | General perturbations / TLE-equivalent element set |
| `donki` | `cme` | Coronal mass ejection |
| `donki` | `solar-flare` | Solar flare (only if the FLR API returns data) |
| `gibs` | `wmts-layer` | Globe imagery layer descriptor, not an observation |

## Notable `values` keys

### nasa-power

- `T2M` (°C) — temperature at 2 meters
- `PRECTOTCORR` (mm/day) — corrected precipitation
- `ALLSKY_SFC_SW_DWN` (kW-hr/m^2/day) — all-sky surface shortwave downward irradiance
- `location_id`, `location_name`, `region`, `time_standard` (`LST`), `elevation_m`

### firms

- `frp` (MW), `brightness` / `brightness_t31` (K), `confidence`, `satellite`, `daynight` (`D` or `N`), `feed`

### celestrak

- `norad_cat_id`, `object_name`, `object_id`, `epoch`, `mean_motion` (rev/day), `inclination` (deg), `eccentricity`, `sample_reason`
- File `extra.catalog_count` is the full active catalog size; `records` is only the sample.

### gibs

- `layer_id`, `theme` (`modis-true-color` \| `viirs-true-color` \| `sea-surface-temperature` \| `snow-ice` \| `ndvi`)
- `wmts_template` — URL template with `{Time}`, `{TileMatrixSet}`, `{TileMatrix}`, `{TileRow}`, `{TileCol}`
- `tile_matrix_set`, `format`, `default_time`, `example_tile_url`, `capabilities_url`

## Manifest

`out/manifest.json`:

```json
{
  "collected_at": "2026-11-14T13:10:00.000Z",
  "collector": "orbit-os-data-collector",
  "version": "1.0.0",
  "output_dir": "/absolute/path/to/out",
  "sources": [
    {
      "id": "eonet",
      "file": "eonet.json",
      "status": "ok",
      "record_count": 0,
      "time_range": { "start": null, "end": null },
      "retrieved_at": "2026-11-14T13:10:00.000Z",
      "errors": [],
      "notes": []
    }
  ]
}
```

`status` is one of:

- `ok` — harvest succeeded
- `partial` — some endpoints or points succeeded, others failed (records that were collected are still real)
- `failed` — no usable records
- `skipped` — deliberately not collected (reserved for FIRMS when no keyless CSV is available and a MAP_KEY would be required)

Loaders should treat `failed` and `skipped` as “do not upsert this source,” and may still read `notes` / `errors` for the UI.
