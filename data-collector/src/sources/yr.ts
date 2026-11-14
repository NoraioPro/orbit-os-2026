import { fetchJson } from "../http.ts";
import { emptyResult, isoNow, record, timeRangeOf } from "../util.ts";
import type { JsonValue, LiveRecord, SourceResult } from "../types.ts";

const FORECAST_URL = "https://api.met.no/weatherapi/locationforecast/2.0/compact";

const AOIS = [
  { id: "oslo", name: "Oslo, Norway", lat: 59.91, lon: 10.75 },
  { id: "svalbard", name: "Longyearbyen, Svalbard", lat: 78.22, lon: 15.65 },
  { id: "north-atlantic", name: "North Atlantic", lat: 60.0, lon: -30.0 },
  { id: "sahel", name: "Niamey, Sahel", lat: 13.5, lon: 2.1 },
  { id: "california", name: "California", lat: 37.77, lon: -122.42 },
];

interface YrTimeseries {
  time: string;
  data: {
    instant: { details: Record<string, number> };
    next_1_hours?: { summary?: { symbol_code?: string } };
    next_6_hours?: { summary?: { symbol_code?: string } };
  };
}

interface YrResponse {
  properties: { meta: { updated_at: string }; timeseries: YrTimeseries[] };
}

/** MET Norway Yr locationforecast/2.0 — 7-day hourly forecast, keyless (requires identifying User-Agent). */
export async function collectYr(): Promise<SourceResult> {
  const retrieved_at = isoNow();
  const records: LiveRecord[] = [];
  const errors: string[] = [];
  try {
    for (const a of AOIS) {
      const url = `${FORECAST_URL}?lat=${a.lat}&lon=${a.lon}`;
      const res = await fetchJson<YrResponse>(url, { timeoutMs: 60_000 });
      const ts = res.properties.timeseries;
      const symbol = (t: YrTimeseries) => t.data.next_1_hours?.summary?.symbol_code ?? t.data.next_6_hours?.summary?.symbol_code ?? null;
      const values: Record<string, JsonValue> = {
        station: a.name,
        updated_at: res.properties.meta.updated_at,
        forecast_hours: ts.length,
        time: ts.map((t) => t.time),
        air_temperature: ts.map((t) => t.data.instant.details.air_temperature),
        precipitation_amount: ts.map((t) => t.data.instant.details.precipitation_amount),
        wind_speed: ts.map((t) => t.data.instant.details.wind_speed),
        wind_from_direction: ts.map((t) => t.data.instant.details.wind_from_direction),
        relative_humidity: ts.map((t) => t.data.instant.details.relative_humidity),
        air_pressure_at_sea_level: ts.map((t) => t.data.instant.details.air_pressure_at_sea_level),
        cloud_area_fraction: ts.map((t) => t.data.instant.details.cloud_area_fraction),
        symbol_code: ts.map(symbol),
        forecast_url: url,
      };
      records.push(
        record({
          id: `yr:${a.id}`,
          source: "yr",
          type: "weather-forecast",
          title: `Weather · ${a.name}`,
          lat: a.lat,
          lon: a.lon,
          time: ts[0].time,
          values,
          units: {
            air_temperature: "°C",
            precipitation_amount: "mm",
            wind_speed: "m/s",
            wind_from_direction: "°",
            relative_humidity: "%",
            air_pressure_at_sea_level: "hPa",
            cloud_area_fraction: "%",
          },
          url,
          retrieved_at,
        }),
      );
    }
  } catch (error) {
    errors.push(String(error));
  }

  if (records.length === 0) {
    return emptyResult("yr", "yr-forecast.json", "failed", errors);
  }
  return {
    id: "yr",
    file: "yr-forecast.json",
    status: errors.length > 0 ? "partial" : "ok",
    records,
    time_range: timeRangeOf(records),
    errors,
    notes: [
      `MET Norway Yr locationforecast/2.0 (compact): ${FORECAST_URL}`,
      `7-day hourly forecast for ${records.length} sites, stored as parallel arrays. Keyless; identifying User-Agent required and set.`,
    ],
    extra: { api: FORECAST_URL, sites: AOIS.length, license: "Creative Commons 4.0 (NLOD) — credit MET Norway" },
  };
}
