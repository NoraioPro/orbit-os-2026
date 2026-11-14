import { fetchJson, HttpError } from "../http.ts";
import { asString, emptyResult, isoNow, record, timeRangeOf, toNumber } from "../util.ts";
import type { JsonValue, LiveRecord, SourceResult } from "../types.ts";

const KP_3H_URL = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json";
const KP_1M_URL = "https://services.swpc.noaa.gov/json/planetary_k_index_1m.json";
const WIND_1M_URL = "https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json";
const MAG_1M_URL = "https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json";

function minuteOf(tag: string | null): number | null {
  if (!tag) return null;
  const m = tag.match(/T\d{2}:(\d{2})/);
  return m ? Number(m[1]) : null;
}

export async function collectSwpc(): Promise<SourceResult> {
  const retrieved_at = isoNow();
  const errors: string[] = [];
  const notes: string[] = [
    "NOAA SWPC JSON feeds: official 3-hour planetary Kp, 1-minute estimated Kp, and RTSW solar-wind plasma + magnetometer.",
    "The older /products/solar-wind/plasma-7-day.json path returns 404 as of this collector; RTSW 1-minute JSON is used instead.",
    "Solar-wind plasma and magnetometer series are stored at 5-minute cadence (real observations where the clock minute is divisible by 5), plus the latest sample of each feed.",
  ];
  const records: LiveRecord[] = [];

  // Official 3-hour Kp
  try {
    const raw = await fetchJson<unknown>(KP_3H_URL, { timeoutMs: 45_000 });
    if (!Array.isArray(raw) || raw.length === 0) {
      errors.push("Kp 3-hour feed was empty");
    } else {
      // First row may be a header array: ["time_tag","Kp",...]
      const rows = raw.filter((row) => row && typeof row === "object" && !Array.isArray(row)) as Record<string, unknown>[];
      const headerOnly = raw[0];
      const fromHeader =
        Array.isArray(headerOnly) && typeof headerOnly[0] === "string"
          ? (raw.slice(1) as unknown[][]).map((r) => {
              const obj: Record<string, unknown> = {};
              (headerOnly as string[]).forEach((k, i) => {
                obj[k] = r[i];
              });
              return obj;
            })
          : rows;
      const dataRows = fromHeader.length > 0 ? fromHeader : rows;
      for (const row of dataRows) {
        const time = asString(row.time_tag);
        const kp = toNumber(row.Kp ?? row.kp);
        records.push(
          record({
            id: `swpc:kp3h:${time}`,
            source: "swpc",
            type: "kp-index",
            title: `Planetary Kp ${kp ?? "n/a"} at ${time ?? "unknown"}`,
            lat: null,
            lon: null,
            time,
            values: {
              kp,
              a_running: toNumber(row.a_running),
              station_count: toNumber(row.station_count),
              cadence: "3-hour",
            },
            units: { kp: "Kp", a_running: "A-index" },
            url: KP_3H_URL,
            retrieved_at,
          }),
        );
      }
      notes.push(`Kp 3-hour: ${dataRows.length} records`);
    }
  } catch (error) {
    errors.push(`Kp 3-hour failed: ${error instanceof HttpError ? error.message : String(error)}`);
  }

  // 1-minute estimated Kp (small window, keep all)
  try {
    const raw = await fetchJson<Record<string, unknown>[]>(KP_1M_URL, { timeoutMs: 45_000 });
    if (!Array.isArray(raw) || raw.length === 0) {
      errors.push("Kp 1-minute feed was empty");
    } else {
      for (const row of raw) {
        const time = asString(row.time_tag);
        records.push(
          record({
            id: `swpc:kp1m:${time}`,
            source: "swpc",
            type: "kp-index-estimated",
            title: `Estimated Kp ${row.estimated_kp ?? row.kp_index ?? "n/a"} at ${time ?? "unknown"}`,
            lat: null,
            lon: null,
            time,
            values: {
              kp_index: toNumber(row.kp_index),
              estimated_kp: toNumber(row.estimated_kp),
              kp_flag: asString(row.kp),
              cadence: "1-minute",
            },
            units: { kp_index: "Kp", estimated_kp: "Kp" },
            url: KP_1M_URL,
            retrieved_at,
          }),
        );
      }
      notes.push(`Kp 1-minute estimated: ${raw.length} records`);
    }
  } catch (error) {
    errors.push(`Kp 1-minute failed: ${error instanceof HttpError ? error.message : String(error)}`);
  }

  // Solar wind plasma, 5-minute samples
  try {
    const raw = await fetchJson<Record<string, unknown>[]>(WIND_1M_URL, { timeoutMs: 90_000 });
    if (!Array.isArray(raw) || raw.length === 0) {
      errors.push("RTSW wind 1-minute feed was empty");
    } else {
      const kept: Record<string, unknown>[] = [];
      raw.forEach((row, index) => {
        const time = asString(row.time_tag);
        const minute = minuteOf(time);
        const isLast = index === raw.length - 1;
        if (isLast || (minute !== null && minute % 5 === 0)) kept.push(row);
      });
      for (const row of kept) {
        const time = asString(row.time_tag);
        const speed = toNumber(row.proton_speed);
        const values: Record<string, JsonValue> = {
          proton_speed: speed,
          proton_density: toNumber(row.proton_density),
          proton_temperature: toNumber(row.proton_temperature),
          proton_vx_gse: toNumber(row.proton_vx_gse),
          proton_vy_gse: toNumber(row.proton_vy_gse),
          proton_vz_gse: toNumber(row.proton_vz_gse),
          active: Boolean(row.active),
          observatory: asString(row.source),
          cadence: "5-minute-sample-from-1-minute",
        };
        records.push(
          record({
            id: `swpc:solar-wind:${time}`,
            source: "swpc",
            type: "solar-wind",
            title: `Solar wind ${speed ?? "n/a"} km/s at ${time ?? "unknown"}`,
            lat: null,
            lon: null,
            time,
            values,
            units: {
              proton_speed: "km/s",
              proton_density: "cm^-3",
              proton_temperature: "K",
              proton_vx_gse: "km/s",
              proton_vy_gse: "km/s",
              proton_vz_gse: "km/s",
            },
            url: WIND_1M_URL,
            retrieved_at,
          }),
        );
      }
      notes.push(`Solar wind RTSW: kept ${kept.length} of ${raw.length} 1-minute samples (5-min cadence + latest)`);
    }
  } catch (error) {
    errors.push(`RTSW wind failed: ${error instanceof HttpError ? error.message : String(error)}`);
  }

  // Magnetometer, 5-minute samples
  try {
    const raw = await fetchJson<Record<string, unknown>[]>(MAG_1M_URL, { timeoutMs: 90_000 });
    if (!Array.isArray(raw) || raw.length === 0) {
      errors.push("RTSW mag 1-minute feed was empty");
    } else {
      const kept: Record<string, unknown>[] = [];
      raw.forEach((row, index) => {
        const time = asString(row.time_tag);
        const minute = minuteOf(time);
        const isLast = index === raw.length - 1;
        if (isLast || (minute !== null && minute % 5 === 0)) kept.push(row);
      });
      for (const row of kept) {
        const time = asString(row.time_tag);
        const bt = toNumber(row.bt);
        const bz = toNumber(row.bz_gsm);
        records.push(
          record({
            id: `swpc:imf:${time}`,
            source: "swpc",
            type: "solar-wind-imf",
            title: `IMF Bt ${bt ?? "n/a"} nT, Bz ${bz ?? "n/a"} nT at ${time ?? "unknown"}`,
            lat: null,
            lon: null,
            time,
            values: {
              bt,
              bx_gse: toNumber(row.bx_gse),
              by_gse: toNumber(row.by_gse),
              bz_gse: toNumber(row.bz_gse),
              bx_gsm: toNumber(row.bx_gsm),
              by_gsm: toNumber(row.by_gsm),
              bz_gsm: bz,
              theta_gsm: toNumber(row.theta_gsm),
              phi_gsm: toNumber(row.phi_gsm),
              active: Boolean(row.active),
              observatory: asString(row.source),
              cadence: "5-minute-sample-from-1-minute",
            },
            units: {
              bt: "nT",
              bx_gse: "nT",
              by_gse: "nT",
              bz_gse: "nT",
              bx_gsm: "nT",
              by_gsm: "nT",
              bz_gsm: "nT",
              theta_gsm: "deg",
              phi_gsm: "deg",
            },
            url: MAG_1M_URL,
            retrieved_at,
          }),
        );
      }
      notes.push(`IMF RTSW mag: kept ${kept.length} of ${raw.length} 1-minute samples (5-min cadence + latest)`);
    }
  } catch (error) {
    errors.push(`RTSW mag failed: ${error instanceof HttpError ? error.message : String(error)}`);
  }

  if (records.length === 0) {
    return emptyResult("swpc", "swpc.json", "failed", errors, notes);
  }

  return {
    id: "swpc",
    file: "swpc.json",
    status: errors.length > 0 ? "partial" : "ok",
    records,
    time_range: timeRangeOf(records),
    errors,
    notes,
  };
}
