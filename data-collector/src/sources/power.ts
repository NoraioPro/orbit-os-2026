import { fetchJson } from "../http.ts";
import {
  isoNow,
  numericOrNull,
  record,
  timeRangeOf,
  ymdCompact,
  ymdUTC,
  emptyResult,
} from "../util.ts";
import type { JsonValue, LiveRecord, SourceResult } from "../types.ts";

const PARAMETERS = "T2M,PRECTOTCORR,ALLSKY_SFC_SW_DWN";
const FILL_VALUE = -999;

export const POWER_POINTS = [
  { id: "oslo", name: "Oslo", lat: 59.9139, lon: 10.7522, region: "Norway" },
  { id: "tromso", name: "Tromsø", lat: 69.6496, lon: 18.956, region: "Norway" },
  { id: "svalbard", name: "Svalbard (Longyearbyen)", lat: 78.2232, lon: 15.6267, region: "Norway" },
  { id: "bergen", name: "Bergen", lat: 60.3913, lon: 5.3221, region: "Norway" },
  { id: "manaus", name: "Amazon (Manaus)", lat: -3.119, lon: -60.0217, region: "hotspot" },
  { id: "los_angeles", name: "California (Los Angeles)", lat: 34.0522, lon: -118.2437, region: "hotspot" },
  { id: "addis_ababa", name: "Horn of Africa (Addis Ababa)", lat: 9.032, lon: 38.7469, region: "hotspot" },
  { id: "dhaka", name: "South Asia (Dhaka)", lat: 23.8103, lon: 90.4125, region: "hotspot" },
  { id: "yakutsk", name: "Siberia (Yakutsk)", lat: 62.0355, lon: 129.6755, region: "hotspot" },
  { id: "greenland_summit", name: "Greenland Summit", lat: 72.5796, lon: -38.4592, region: "hotspot" },
  { id: "alice_springs", name: "Australian Outback (Alice Springs)", lat: -23.698, lon: 133.8807, region: "hotspot" },
  { id: "niamey", name: "Sahel (Niamey)", lat: 13.5116, lon: 2.1254, region: "hotspot" },
  { id: "great_barrier_reef", name: "Great Barrier Reef", lat: -18.2871, lon: 147.6992, region: "hotspot" },
  { id: "kisangani", name: "Congo Basin (Kisangani)", lat: 0.5153, lon: 25.19, region: "hotspot" },
] as const;

interface PowerResponse {
  type?: string;
  geometry?: { coordinates?: number[] };
  header?: { fill_value?: number; time_standard?: string; start?: string; end?: string };
  parameters?: Record<string, { units?: string; longname?: string }>;
  properties?: {
    parameter?: Record<string, Record<string, number>>;
  };
  messages?: unknown[];
}

function powerUrl(lat: number, lon: number, start: string, end: string): string {
  const params = new URLSearchParams({
    parameters: PARAMETERS,
    community: "RE",
    longitude: String(lon),
    latitude: String(lat),
    start,
    end,
    format: "JSON",
  });
  return `https://power.larc.nasa.gov/api/temporal/daily/point?${params.toString()}`;
}

function parseYmdKey(key: string): string | null {
  if (!/^\d{8}$/.test(key)) return null;
  return `${key.slice(0, 4)}-${key.slice(4, 6)}-${key.slice(6, 8)}`;
}

async function fetchPoint(
  point: (typeof POWER_POINTS)[number],
  start: string,
  end: string,
  retrieved_at: string,
): Promise<{ records: LiveRecord[]; note: string }> {
  const url = powerUrl(point.lat, point.lon, start, end);
  const data = await fetchJson<PowerResponse>(url, { timeoutMs: 120_000, retries: 4, retryDelayMs: 2000 });
  const paramBlock = data.properties?.parameter ?? {};
  const fill = data.header?.fill_value ?? FILL_VALUE;
  const unitsMeta = data.parameters ?? {};
  const units: Record<string, string> = {};
  for (const [key, meta] of Object.entries(unitsMeta)) {
    if (meta?.units) units[key] = meta.units;
  }

  const dateSet = new Set<string>();
  for (const series of Object.values(paramBlock)) {
    for (const key of Object.keys(series)) dateSet.add(key);
  }
  const dates = [...dateSet].sort();
  const elevation = Array.isArray(data.geometry?.coordinates) ? data.geometry!.coordinates![2] : null;
  const records: LiveRecord[] = [];

  for (const key of dates) {
    const day = parseYmdKey(key);
    if (!day) continue;
    const t2m = numericOrNull(paramBlock.T2M?.[key], fill);
    const prcp = numericOrNull(paramBlock.PRECTOTCORR?.[key], fill);
    const sw = numericOrNull(paramBlock.ALLSKY_SFC_SW_DWN?.[key], fill);
    const values: Record<string, JsonValue> = {
      location_id: point.id,
      location_name: point.name,
      region: point.region,
      T2M: t2m,
      PRECTOTCORR: prcp,
      ALLSKY_SFC_SW_DWN: sw,
      time_standard: data.header?.time_standard ?? "LST",
      elevation_m: elevation ?? null,
    };
    records.push(
      record({
        id: `power:${point.id}:${day}`,
        source: "nasa-power",
        type: "daily-climate",
        title: `${point.name} climate ${day}`,
        lat: point.lat,
        lon: point.lon,
        time: day,
        values,
        units: { ...units, elevation_m: "m" },
        url,
        retrieved_at,
      }),
    );
  }

  return {
    records,
    note: `${point.name}: ${records.length} daily rows ${start}–${end}`,
  };
}

export async function collectPower(): Promise<SourceResult> {
  const retrieved_at = isoNow();
  const end = new Date();
  const start = new Date(Date.UTC(end.getUTCFullYear() - 5, end.getUTCMonth(), end.getUTCDate()));
  const startStr = ymdCompact(start);
  const endStr = ymdCompact(end);
  const errors: string[] = [];
  const notes: string[] = [
    `NASA POWER daily point API, community=RE, parameters=${PARAMETERS}.`,
    `Requested window ${ymdUTC(start)} to ${ymdUTC(end)} (5 years, inclusive of today; fill values of ${FILL_VALUE} stored as null).`,
    "Times are local solar time (LST) dates from POWER, not UTC instants.",
    `Points: 4 Norwegian sites + 10 global climate/disaster hotspots (${POWER_POINTS.length} total).`,
  ];
  const records: LiveRecord[] = [];

  // Be polite: two concurrent point requests.
  const queue = [...POWER_POINTS];
  const workers = 2;
  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const point = queue.shift();
      if (!point) return;
      try {
        const result = await fetchPoint(point, startStr, endStr, retrieved_at);
        records.push(...result.records);
        notes.push(result.note);
      } catch (error) {
        errors.push(`${point.name} (${point.id}) failed: ${String(error)}`);
      }
    }
  }
  await Promise.all(Array.from({ length: workers }, () => worker()));

  if (records.length === 0) {
    return emptyResult("nasa-power", "nasa-power.json", "failed", errors, notes);
  }

  return {
    id: "nasa-power",
    file: "nasa-power.json",
    status: errors.length > 0 ? "partial" : "ok",
    records,
    time_range: timeRangeOf(records),
    errors,
    notes,
    extra: {
      point_count: POWER_POINTS.length,
      points_ok: POWER_POINTS.length - errors.length,
      parameters: PARAMETERS,
    },
  };
}
