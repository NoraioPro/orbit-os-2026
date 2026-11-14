import { fetchText, HttpError } from "../http.ts";
import {
  asString,
  emptyResult,
  isoNow,
  parseCsv,
  record,
  timeRangeOf,
  toNumber,
} from "../util.ts";
import type { JsonValue, LiveRecord, SourceResult } from "../types.ts";

/**
 * Keyless 24h public CSVs published by NASA FIRMS (no MAP_KEY required).
 * The official area/country API at /api/area/ still requires a MAP_KEY:
 *   https://firms.modaps.eosdis.nasa.gov/api/area/
 * These public NRT CSVs were verified live during collector development.
 */
const FEEDS = [
  {
    id: "modis_c6_1_global_24h",
    satellite: "MODIS",
    url: "https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_Global_24h.csv",
  },
  {
    id: "viirs_n20_global_24h",
    satellite: "VIIRS-NOAA-20",
    url: "https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_Global_24h.csv",
  },
  {
    id: "viirs_n21_global_24h",
    satellite: "VIIRS-NOAA-21",
    url: "https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-21-viirs-c2/csv/J2_VIIRS_C2_Global_24h.csv",
  },
  {
    id: "viirs_snpp_global_24h",
    satellite: "VIIRS-SNPP",
    url: "https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Global_24h.csv",
  },
] as const;

function acqIso(date: string, time: string): string | null {
  const d = date.trim();
  const t = time.trim().padStart(4, "0");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const hh = t.slice(0, 2);
  const mm = t.slice(2, 4);
  if (!/^\d{2}$/.test(hh) || !/^\d{2}$/.test(mm)) return `${d}T00:00:00Z`;
  return `${d}T${hh}:${mm}:00Z`;
}

export async function collectFirms(): Promise<SourceResult> {
  const retrieved_at = isoNow();
  const errors: string[] = [];
  const notes: string[] = [
    "NASA FIRMS keyless public 24-hour NRT CSVs (no MAP_KEY).",
    "The MAP_KEY API (https://firms.modaps.eosdis.nasa.gov/api/area/) is not required for these global 24h dumps.",
  ];
  const records: LiveRecord[] = [];
  let anyHttpOk = false;

  for (const feed of FEEDS) {
    try {
      const { body, status } = await fetchText(feed.url, { timeoutMs: 90_000, accept: "text/csv,*/*" });
      anyHttpOk = true;
      const rows = parseCsv(body);
      if (rows.length === 0) {
        notes.push(`${feed.id}: HTTP ${status} but CSV had no data rows (header only or empty).`);
        continue;
      }
      let added = 0;
      for (const row of rows) {
        const lat = toNumber(row.latitude);
        const lon = toNumber(row.longitude);
        const time = acqIso(row.acq_date ?? "", row.acq_time ?? "");
        const brightness = toNumber(row.brightness ?? row.bright_ti4);
        const brightT31 = toNumber(row.bright_t31 ?? row.bright_ti5);
        const frp = toNumber(row.frp);
        const confidence = asString(row.confidence);
        const values: Record<string, JsonValue> = {
          feed: feed.id,
          satellite: row.satellite || feed.satellite,
          instrument: feed.satellite.startsWith("VIIRS") ? "VIIRS" : "MODIS",
          brightness,
          brightness_t31: brightT31,
          frp,
          confidence,
          scan: toNumber(row.scan),
          track: toNumber(row.track),
          daynight: row.daynight ?? null,
          version: row.version ?? null,
        };
        const idParts = [
          "firms",
          feed.id,
          row.acq_date,
          row.acq_time,
          lat,
          lon,
          row.satellite,
          row.daynight,
        ];
        records.push(
          record({
            id: idParts.join(":"),
            source: "firms",
            type: "active-fire",
            title: `Active fire (${row.satellite || feed.satellite}) FRP ${frp ?? "n/a"} MW`,
            lat,
            lon,
            time,
            values,
            units: {
              brightness: "K",
              brightness_t31: "K",
              frp: "MW",
              scan: "km",
              track: "km",
            },
            url: feed.url,
            retrieved_at,
          }),
        );
        added++;
      }
      notes.push(`${feed.id}: ${added} detections`);
    } catch (error) {
      const message = error instanceof HttpError ? error.message : String(error);
      errors.push(`${feed.id} failed: ${message}`);
    }
  }

  if (records.length === 0) {
    const status = anyHttpOk ? "skipped" : "failed";
    if (!anyHttpOk) {
      notes.push(
        "No keyless FIRMS CSV could be downloaded. A FIRMS MAP_KEY from https://firms.modaps.eosdis.nasa.gov/api/ is required for the /api/area/ and /api/country/ endpoints.",
      );
    }
    return emptyResult("firms", "firms.json", status, errors, notes);
  }

  return {
    id: "firms",
    file: "firms.json",
    status: errors.length > 0 ? "partial" : "ok",
    records,
    time_range: timeRangeOf(records),
    errors,
    notes,
  };
}
