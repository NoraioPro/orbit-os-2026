import { fetchJson } from "../http.ts";
import { emptyResult, isoNow, record, timeRangeOf, utcDaysAgo, ymdUTC } from "../util.ts";
import type { JsonValue, LiveRecord, SourceResult } from "../types.ts";

const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";

const AOIS = [
  { id: "oslo", name: "Oslo, Norway", lat: 59.91, lon: 10.75 },
  { id: "svalbard", name: "Longyearbyen, Svalbard", lat: 78.22, lon: 15.65 },
  { id: "north-atlantic", name: "North Atlantic", lat: 60.0, lon: -30.0 },
  { id: "sahel", name: "Niamey, Sahel", lat: 13.5, lon: 2.1 },
  { id: "california", name: "California", lat: 37.77, lon: -122.42 },
];

interface ArchiveResponse {
  daily: { time: string[]; temperature_2m_mean: number[]; precipitation_sum: number[] };
}

/** Open-Meteo archive — daily weather history (2000 → yesterday), keyless, CORS-open. */
export async function collectOpenMeteo(): Promise<SourceResult> {
  const retrieved_at = isoNow();
  const records: LiveRecord[] = [];
  const errors: string[] = [];
  const start = "2000-01-01";
  const end = ymdUTC(utcDaysAgo(1));

  try {
    for (const a of AOIS) {
      const url = `${ARCHIVE_URL}?latitude=${a.lat}&longitude=${a.lon}&start_date=${start}&end_date=${end}&daily=temperature_2m_mean,precipitation_sum`;
      const res = await fetchJson<ArchiveResponse>(url, { timeoutMs: 90_000 });
      const daily = res.daily;
      const values: Record<string, JsonValue> = {
        station: a.name,
        time: daily.time,
        temperature_2m_mean: daily.temperature_2m_mean,
        precipitation_sum: daily.precipitation_sum,
        archive_url: url,
      };
      records.push(
        record({
          id: `openmeteo:${a.id}`,
          source: "openmeteo",
          type: "weather-history",
          title: `Weather history · ${a.name}`,
          lat: a.lat,
          lon: a.lon,
          time: daily.time[daily.time.length - 1],
          values,
          units: { temperature_2m_mean: "°C", precipitation_sum: "mm" },
          url,
          retrieved_at,
        }),
      );
    }
  } catch (error) {
    errors.push(String(error));
  }

  if (records.length === 0) {
    return emptyResult("openmeteo", "openmeteo-history.json", "failed", errors);
  }
  return {
    id: "openmeteo",
    file: "openmeteo-history.json",
    status: errors.length > 0 ? "partial" : "ok",
    records,
    time_range: timeRangeOf(records),
    errors,
    notes: [
      `Open-Meteo archive (ERA5 reanalysis + station): ${ARCHIVE_URL}`,
      `Daily temperature and precipitation ${start} → ${end} for ${records.length} sites, stored as parallel arrays. Keyless and CORS-open.`,
    ],
    extra: { api: ARCHIVE_URL, sites: AOIS.length, window_start: start, window_end: end, license: "CC BY 4.0 — credit Open-Meteo" },
  };
}
