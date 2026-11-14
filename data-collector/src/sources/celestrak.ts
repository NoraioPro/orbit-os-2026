import { fetchJson } from "../http.ts";
import { asString, emptyResult, isoNow, record, timeRangeOf, toNumber } from "../util.ts";
import type { JsonValue, LiveRecord, SourceResult } from "../types.ts";

const URL = "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=json";
const SAMPLE_SIZE = 300;

/** Well-known NORAD catalog IDs included in the sample when present in the catalog. */
const PRIORITY_NORAD = [
  25544, // ISS (ZARYA)
  20580, // Hubble
  48274, // CSS / Tianhe
  25994, // Terra
  27424, // Aqua
  37849, // Suomi NPP
  43013, // NOAA-20
  54234, // NOAA-21
  39084, // Landsat 8
  49260, // Landsat 9
  43437, // Sentinel-2B / check later - don't invent if missing
  40697, // Sentinel-2A
  41335, // Sentinel-3A
  36508, // GOES-15 historically; inclusion only if present
  51850, // JWST
  28485, // CALIPSO (may have deorbited; include only if present)
];

interface GpRecord {
  OBJECT_NAME?: string;
  OBJECT_ID?: string;
  EPOCH?: string;
  MEAN_MOTION?: number;
  ECCENTRICITY?: number;
  INCLINATION?: number;
  RA_OF_ASC_NODE?: number;
  ARG_OF_PERICENTER?: number;
  MEAN_ANOMALY?: number;
  NORAD_CAT_ID?: number;
  BSTAR?: number;
  MEAN_MOTION_DOT?: number;
  CLASSIFICATION_TYPE?: string;
  REV_AT_EPOCH?: number;
}

function toLive(row: GpRecord, retrieved_at: string, sampleReason: string): LiveRecord {
  const norad = toNumber(row.NORAD_CAT_ID);
  const name = asString(row.OBJECT_NAME) ?? `NORAD ${norad ?? "unknown"}`;
  const epoch = asString(row.EPOCH);
  const values: Record<string, JsonValue> = {
    object_name: name,
    object_id: asString(row.OBJECT_ID),
    norad_cat_id: norad,
    epoch,
    mean_motion: toNumber(row.MEAN_MOTION),
    eccentricity: toNumber(row.ECCENTRICITY),
    inclination: toNumber(row.INCLINATION),
    ra_of_asc_node: toNumber(row.RA_OF_ASC_NODE),
    arg_of_pericenter: toNumber(row.ARG_OF_PERICENTER),
    mean_anomaly: toNumber(row.MEAN_ANOMALY),
    bstar: toNumber(row.BSTAR),
    mean_motion_dot: toNumber(row.MEAN_MOTION_DOT),
    classification: asString(row.CLASSIFICATION_TYPE),
    rev_at_epoch: toNumber(row.REV_AT_EPOCH),
    sample_reason: sampleReason,
  };
  return record({
    id: `celestrak:${norad ?? name}`,
    source: "celestrak",
    type: "satellite-gp",
    title: name,
    lat: null,
    lon: null,
    time: epoch ? (epoch.endsWith("Z") ? epoch : `${epoch}Z`) : null,
    values,
    units: {
      mean_motion: "rev/day",
      inclination: "deg",
      ra_of_asc_node: "deg",
      arg_of_pericenter: "deg",
      mean_anomaly: "deg",
      eccentricity: "dimensionless",
    },
    url: URL,
    retrieved_at,
  });
}

export async function collectCelestrak(): Promise<SourceResult> {
  const retrieved_at = isoNow();
  try {
    const catalog = await fetchJson<GpRecord[]>(URL, { timeoutMs: 120_000 });
    if (!Array.isArray(catalog) || catalog.length === 0) {
      return emptyResult("celestrak", "celestrak.json", "failed", ["Celestrak active GP JSON was empty"]);
    }

    const byNorad = new Map<number, GpRecord>();
    for (const row of catalog) {
      const id = toNumber(row.NORAD_CAT_ID);
      if (id != null) byNorad.set(id, row);
    }

    const chosen = new Map<number, { row: GpRecord; reason: string }>();
    for (const norad of PRIORITY_NORAD) {
      const row = byNorad.get(norad);
      if (row) chosen.set(norad, { row, reason: "priority-object" });
    }

    // Deterministic stride sample across the full catalog (sorted by NORAD id).
    const sorted = [...catalog].sort((a, b) => (a.NORAD_CAT_ID ?? 0) - (b.NORAD_CAT_ID ?? 0));
    const remainingSlots = Math.max(0, SAMPLE_SIZE - chosen.size);
    const stride = Math.max(1, Math.floor(sorted.length / Math.max(remainingSlots, 1)));
    for (let i = 0; i < sorted.length && chosen.size < SAMPLE_SIZE; i += stride) {
      const row = sorted[i];
      const norad = toNumber(row.NORAD_CAT_ID);
      if (norad == null) continue;
      if (!chosen.has(norad)) chosen.set(norad, { row, reason: "stride-sample" });
    }
    // If stride collisions with priority left us short, fill sequentially.
    for (const row of sorted) {
      if (chosen.size >= SAMPLE_SIZE) break;
      const norad = toNumber(row.NORAD_CAT_ID);
      if (norad == null || chosen.has(norad)) continue;
      chosen.set(norad, { row, reason: "fill-sample" });
    }

    const records = [...chosen.values()]
      .sort((a, b) => (a.row.NORAD_CAT_ID ?? 0) - (b.row.NORAD_CAT_ID ?? 0))
      .map((item) => toLive(item.row, retrieved_at, item.reason));

    return {
      id: "celestrak",
      file: "celestrak.json",
      status: "ok",
      records,
      time_range: timeRangeOf(records),
      errors: [],
      notes: [
        `Celestrak active satellite GP (JSON) catalog count: ${catalog.length}.`,
        `Stored a deterministic sample of ${records.length} objects (priority NORAD IDs when present, plus a stride sample). The full catalog is not written.`,
      ],
      extra: {
        catalog_count: catalog.length,
        sample_count: records.length,
        sample_size_requested: SAMPLE_SIZE,
      },
    };
  } catch (error) {
    return emptyResult("celestrak", "celestrak.json", "failed", [String(error)]);
  }
}
