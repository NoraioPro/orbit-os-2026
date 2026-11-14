import { emptyResult, isoNow, record, timeRangeOf, utcDaysAgo, ymdUTC } from "../util.ts";
import type { JsonValue, LiveRecord, SourceResult } from "../types.ts";

// NASA ASF (Alaska Satellite Facility) SAR catalog search.
// Public for metadata search (no auth); protected downloads need an Earthdata login.
// Covers NISAR, Sentinel-1, ALOS PALSAR, OPERA/ARIA-derived, UAVSAR.
const ASF_URL = "https://api.daac.asf.alaska.edu/services/search/param";

const AOIS: { id: string; bbox: string }[] = [
  { id: "oslo", bbox: "10.0,59.5,11.5,60.5" },
  { id: "sahel", bbox: "1.5,12.5,3.0,14.0" },
  { id: "california", bbox: "-120.5,36.0,-119.0,37.5" },
];
const PLATFORMS = ["NISAR", "SENTINEL-1A"];

const num = (v: unknown): number | null => { const n = parseFloat(String(v)); return Number.isFinite(n) ? n : null; };

export async function collectAsf(): Promise<SourceResult> {
  const retrieved_at = isoNow();
  try {
    const records: LiveRecord[] = [];
    const errors: string[] = [];
    const notes: string[] = [
      "NASA ASF SAR catalog search (public metadata; protected downloads require an Earthdata login).",
      "NISAR + Sentinel-1A over 3 AOIs, last 30 days. This is a scene manifest, not downloaded pixels.",
    ];
    const start = ymdUTC(utcDaysAgo(30));
    const end = ymdUTC(new Date());

    for (const platform of PLATFORMS) {
      for (const aoi of AOIS) {
        const url = `${ASF_URL}?platform=${platform}&bbox=${aoi.bbox}&start=${start}&end=${end}&output=JSON&maxResults=6`;
        let items: Record<string, any>[];
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(45_000), headers: { Accept: "application/json" } });
          if (!res.ok) { errors.push(`${platform}/${aoi.id} HTTP ${res.status}`); continue; }
          const j = await res.json();
          items = Array.isArray(j) ? (Array.isArray(j[0]) ? j.flat() : j) : (j.results ?? []);
        } catch (e) { errors.push(`${platform}/${aoi.id}: ${String(e)}`); continue; }

        for (const g of items) {
          const lat = num(g.centerLat) ?? num(g.farStartLat) ?? num(g.nearStartLat);
          const lon = num(g.centerLon) ?? num(g.farStartLon) ?? num(g.nearStartLon);
          const browse = Array.isArray(g.browse) ? (g.browse[0] as string) : (g.browse as string | undefined) ?? null;
          records.push(record({
            id: `asf:${g.granuleName ?? g.fileName ?? `${platform}-${aoi.id}-${records.length}`}`,
            source: "asf",
            type: "sar-scene",
            title: `${platform} ${g.processingLevel ?? "SAR"} · ${g.startTime ?? "no time"} (${aoi.id})`,
            lat, lon,
            time: g.startTime ?? null,
            values: {
              platform,
              processing_level: g.processingLevel ?? null,
              polarization: g.polarization ?? null,
              beam_mode: g.beamMode ?? null,
              flight_direction: g.flightDirection ?? null,
              relative_orbit: g.relativeOrbit ?? null,
              track: g.track ?? null,
              sensor: g.sensor ?? null,
              frame: g.frameNumber ?? null,
              stop_time: g.stopTime ?? null,
              browse_url: browse,
              thumbnail_url: g.thumbnailUrl ?? null,
              aoi: aoi.id,
            } as Record<string, JsonValue>,
            units: {},
            url: g.downloadUrl ?? browse,
            retrieved_at,
          }));
        }
      }
    }

    if (records.length === 0) return emptyResult("asf", "asf.json", errors.length ? "failed" : "partial", errors, notes);
    return { id: "asf", file: "asf.json", status: errors.length ? "partial" : "ok", records, time_range: timeRangeOf(records), errors, notes, extra: { platforms: PLATFORMS } };
  } catch (error) {
    return emptyResult("asf", "asf.json", "failed", [String(error)]);
  }
}
