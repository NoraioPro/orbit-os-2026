import { fetchJson, HttpError } from "../http.ts";
import { asString, emptyResult, isoNow, record, timeRangeOf, toNumber, ymdUTC } from "../util.ts";
import type { JsonValue, LiveRecord, SourceResult } from "../types.ts";

const API_KEY = process.env.NASA_API_KEY || "DEMO_KEY";

function donkiUrl(path: "CME" | "FLR", start: string, end: string): string {
  const params = new URLSearchParams({ startDate: start, endDate: end, api_key: API_KEY });
  return `https://api.nasa.gov/DONKI/${path}?${params.toString()}`;
}

interface CmeAnalysis {
  isMostAccurate?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  speed?: number | null;
  halfAngle?: number | null;
  type?: string | null;
  time21_5?: string | null;
  link?: string;
  measurementTechnique?: string | null;
}

interface CmeEvent {
  activityID?: string;
  catalog?: string;
  startTime?: string;
  sourceLocation?: string;
  activeRegionNum?: number | null;
  note?: string;
  link?: string;
  instruments?: { displayName?: string }[];
  cmeAnalyses?: CmeAnalysis[];
}

interface FlrEvent {
  flrID?: string;
  beginTime?: string;
  peakTime?: string;
  endTime?: string;
  classType?: string;
  sourceLocation?: string;
  activeRegionNum?: number | null;
  link?: string;
  instruments?: { displayName?: string }[];
  note?: string;
}

function parseHelioLocation(loc: string | null | undefined): { lat: number | null; lon: number | null } {
  if (!loc) return { lat: null, lon: null };
  // Typical DONKI locations look like "N15W20" or "S12E03"
  const m = loc.trim().match(/^([NS])\s*(\d+(?:\.\d+)?)\s*([EW])\s*(\d+(?:\.\d+)?)$/i);
  if (!m) return { lat: null, lon: null };
  const lat = Number(m[2]) * (m[1].toUpperCase() === "S" ? -1 : 1);
  const lon = Number(m[4]) * (m[3].toUpperCase() === "W" ? -1 : 1);
  return { lat, lon };
}

export async function collectDonki(): Promise<SourceResult> {
  const retrieved_at = isoNow();
  const end = new Date();
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - 30);
  const startDate = ymdUTC(start);
  const endDate = ymdUTC(end);
  const errors: string[] = [];
  const notes: string[] = [
    `NASA DONKI via api.nasa.gov using ${API_KEY === "DEMO_KEY" ? "DEMO_KEY" : "NASA_API_KEY"} for the last 30 days (${startDate} to ${endDate}).`,
  ];
  const records: LiveRecord[] = [];

  try {
    const cmes = await fetchJson<CmeEvent[]>(donkiUrl("CME", startDate, endDate), { timeoutMs: 90_000 });
    if (!Array.isArray(cmes)) {
      errors.push("DONKI CME response was not an array");
    } else {
      for (const ev of cmes) {
        const analyses = ev.cmeAnalyses ?? [];
        const best = analyses.find((a) => a.isMostAccurate) ?? analyses[0];
        const fromSource = parseHelioLocation(ev.sourceLocation);
        const lat = best?.latitude ?? fromSource.lat;
        const lon = best?.longitude ?? fromSource.lon;
        const time = asString(ev.startTime);
        const values: Record<string, JsonValue> = {
          activity_id: ev.activityID ?? null,
          catalog: ev.catalog ?? null,
          source_location: ev.sourceLocation || null,
          active_region: ev.activeRegionNum ?? null,
          speed: best?.speed ?? null,
          half_angle: best?.halfAngle ?? null,
          cme_type: best?.type ?? null,
          time_21_5rs: best?.time21_5 ?? null,
          measurement_technique: best?.measurementTechnique ?? null,
          instruments: (ev.instruments ?? []).map((i) => i.displayName ?? "").filter(Boolean),
          note: ev.note ?? null,
        };
        records.push(
          record({
            id: ev.activityID ?? `donki-cme:${time}`,
            source: "donki",
            type: "cme",
            title: `CME ${ev.activityID ?? time ?? ""}`.trim(),
            lat: lat ?? null,
            lon: lon ?? null,
            time,
            values,
            units: {
              speed: "km/s",
              half_angle: "deg",
              latitude: "deg (heliographic)",
              longitude: "deg (heliographic)",
            },
            url: ev.link ?? "https://ccmc.gsfc.nasa.gov/donki/",
            retrieved_at,
          }),
        );
      }
      notes.push(`CME: ${cmes.length} events`);
    }
  } catch (error) {
    errors.push(`DONKI CME failed: ${error instanceof HttpError ? error.message : String(error)}`);
  }

  try {
    const flares = await fetchJson<FlrEvent[]>(donkiUrl("FLR", startDate, endDate), { timeoutMs: 90_000 });
    if (!Array.isArray(flares)) {
      errors.push("DONKI FLR response was not an array");
    } else {
      for (const ev of flares) {
        const loc = parseHelioLocation(ev.sourceLocation);
        const time = asString(ev.peakTime ?? ev.beginTime);
        records.push(
          record({
            id: ev.flrID ?? `donki-flr:${time}`,
            source: "donki",
            type: "solar-flare",
            title: `Solar flare ${ev.classType ?? ""} ${ev.flrID ?? ""}`.trim(),
            lat: loc.lat,
            lon: loc.lon,
            time,
            values: {
              flr_id: ev.flrID ?? null,
              class_type: ev.classType ?? null,
              begin_time: ev.beginTime ?? null,
              peak_time: ev.peakTime ?? null,
              end_time: ev.endTime ?? null,
              source_location: ev.sourceLocation ?? null,
              active_region: ev.activeRegionNum ?? null,
              instruments: (ev.instruments ?? []).map((i) => i.displayName ?? "").filter(Boolean),
              note: ev.note ?? null,
            },
            units: { class_type: "GOES X-ray class" },
            url: ev.link ?? "https://ccmc.gsfc.nasa.gov/donki/",
            retrieved_at,
          }),
        );
      }
      notes.push(`FLR: ${flares.length} events`);
    }
  } catch (error) {
    const message = error instanceof HttpError ? error.message : String(error);
    errors.push(`DONKI FLR failed: ${message}`);
    notes.push(
      "The official api.nasa.gov/DONKI/FLR endpoint returned an error. Flares were not fabricated. CME records (if any) are still included. Set NASA_API_KEY for a higher rate limit; it does not restore a missing FLR route.",
    );
  }

  if (records.length === 0) {
    return emptyResult("donki", "donki.json", "failed", errors, notes);
  }

  const hasCme = records.some((r) => r.type === "cme");
  const hasFlr = records.some((r) => r.type === "solar-flare");
  const status = errors.length > 0 || (hasCme && !hasFlr) ? "partial" : "ok";

  return {
    id: "donki",
    file: "donki.json",
    status,
    records,
    time_range: timeRangeOf(records),
    errors,
    notes,
    extra: {
      cme_count: records.filter((r) => r.type === "cme").length,
      flare_count: records.filter((r) => r.type === "solar-flare").length,
      start_date: startDate,
      end_date: endDate,
    },
  };
}
