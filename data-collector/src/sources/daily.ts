import { fetchJson } from "../http.ts";
import { emptyResult, isoNow, record, timeRangeOf } from "../util.ts";
import type { JsonValue, LiveRecord, SourceResult } from "../types.ts";

const OM_ARCHIVE = "https://archive-api.open-meteo.com/v1/archive";
const USGS_QUERY = "https://earthquake.usgs.gov/fdsnws/event/1/query";

const SITES = [
  { id: "oslo", name: "Oslo, Norway", lat: 59.91, lon: 10.75 },
  { id: "svalbard", name: "Longyearbyen, Svalbard", lat: 78.22, lon: 15.65 },
  { id: "north-atlantic", name: "North Atlantic", lat: 60.0, lon: -30.0 },
  { id: "sahel", name: "Niamey, Sahel", lat: 13.5, lon: 2.1 },
  { id: "california", name: "California", lat: 37.77, lon: -122.42 },
];

const START = "2020-01-01";
const END = "2026-11-14";

interface OmDaily { time: string[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_sum: number[]; soil_moisture_0_to_7cm_mean: number[] }
interface UsgsFeature { properties?: { time?: number } }

/** 6-year DAILY history (365 d/yr) for the prediction engine: Open-Meteo weather + USGS M5+ earthquake counts. */
export async function collectDaily(): Promise<SourceResult> {
  const retrieved_at = isoNow();
  const records: LiveRecord[] = [];
  const errors: string[] = [];
  try {
    for (const s of SITES) {
      const url = `${OM_ARCHIVE}?latitude=${s.lat}&longitude=${s.lon}&start_date=${START}&end_date=${END}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,soil_moisture_0_to_7cm_mean`;
      const d = await fetchJson<{ daily: OmDaily }>(url, { timeoutMs: 90_000 });
      const daily = d.daily;
      const values: Record<string, JsonValue> = {
        site: s.name,
        time: daily.time,
        temperature_2m_max: daily.temperature_2m_max,
        temperature_2m_min: daily.temperature_2m_min,
        precipitation_sum: daily.precipitation_sum,
        soil_moisture_0_to_7cm_mean: daily.soil_moisture_0_to_7cm_mean,
      };
      records.push(
        record({
          id: `daily:weather:${s.id}`,
          source: "daily",
          type: "daily-weather",
          title: `Daily weather ${START} → ${END} · ${s.name}`,
          lat: s.lat,
          lon: s.lon,
          time: daily.time[daily.time.length - 1],
          values,
          units: { temperature_2m_max: "°C", temperature_2m_min: "°C", precipitation_sum: "mm", soil_moisture_0_to_7cm_mean: "m³/m³" },
          url,
          retrieved_at,
        }),
      );
    }

    // Daily M5+ earthquake counts (6 years), aggregated from the FDSN query feed.
    const eqUrl = `${USGS_QUERY}?format=geojson&starttime=${START}&endtime=${END}&minmagnitude=5&orderby=time`;
    const eq = await fetchJson<{ features?: UsgsFeature[] }>(eqUrl, { timeoutMs: 120_000 });
    const counts = new Map<string, number>();
    for (const f of eq.features ?? []) {
      const t = f.properties?.time;
      if (t) { const day = new Date(t).toISOString().slice(0, 10); counts.set(day, (counts.get(day) ?? 0) + 1); }
    }
    const days = [...counts.keys()].sort();
    records.push(
      record({
        id: "daily:earthquakes",
        source: "daily",
        type: "daily-earthquakes",
        title: `Daily M5+ earthquakes ${START} → ${END}`,
        lat: null,
        lon: null,
        time: days[days.length - 1] ?? null,
        values: { time: days, count: days.map((d) => counts.get(d) ?? 0) },
        units: { count: "events/day" },
        url: eqUrl,
        retrieved_at,
      }),
    );
  } catch (error) {
    errors.push(String(error));
  }

  if (records.length === 0) {
    return emptyResult("daily", "daily-history.json", "failed", errors);
  }
  return {
    id: "daily",
    file: "daily-history.json",
    status: errors.length > 0 ? "partial" : "ok",
    records,
    time_range: timeRangeOf(records),
    errors,
    notes: [
      `6-year daily history (${START} → ${END}, 365 d/yr) for the prediction engine.`,
      `Open-Meteo daily weather for ${SITES.length} sites + USGS M5+ daily earthquake counts. Stored as parallel day/value arrays.`,
    ],
    extra: { window_start: START, window_end: END, sites: SITES.length },
  };
}
