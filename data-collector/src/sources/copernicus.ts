import { emptyResult, isoNow, record, timeRangeOf, utcDaysAgo, ymdUTC } from "../util.ts";
import type { JsonValue, LiveRecord, SourceResult } from "../types.ts";

// Copernicus Data Space Ecosystem — Sentinel catalog (STAC).
// Requires a free CDSE account's OAuth client credentials (set CDSE_CLIENT_ID and
// CDSE_CLIENT_SECRET). Without them this source reports `skipped`, never invented data.
const TOKEN_URL = "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token";
const STAC_URL = "https://catalogue.dataspace.copernicus.eu/stac/search";

const AOIS: { id: string; bbox: string }[] = [
  { id: "oslo", bbox: "10.0,59.5,11.5,60.5" },
  { id: "sahel", bbox: "1.5,12.5,3.0,14.0" },
  { id: "california", bbox: "-120.5,36.0,-119.0,37.5" },
];
const COLLECTIONS = ["sentinel-2-l2a", "sentinel-1-grd"];

async function getToken(): Promise<string | null> {
  const id = process.env.CDSE_CLIENT_ID;
  const secret = process.env.CDSE_CLIENT_SECRET;
  if (!id || !secret) return null;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: secret }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`CDSE token endpoint HTTP ${res.status}`);
  const j = (await res.json()) as { access_token?: string };
  if (!j.access_token) throw new Error("CDSE token response missing access_token");
  return j.access_token;
}

export async function collectCopernicus(): Promise<SourceResult> {
  const retrieved_at = isoNow();
  try {
    const token = await getToken();
    if (!token) {
      return emptyResult("copernicus", "copernicus.json", "skipped", [], [
        "Copernicus Data Space credentials not configured. Set CDSE_CLIENT_ID and CDSE_CLIENT_SECRET to enable Sentinel collection.",
      ]);
    }
    const start = ymdUTC(utcDaysAgo(30));
    const end = ymdUTC(new Date());
    const records: LiveRecord[] = [];
    const errors: string[] = [];
    const notes: string[] = [
      "Copernicus Data Space STAC search (Sentinel-2 L2A + Sentinel-1 GRD) over 3 AOIs, last 30 days.",
      "This is a scene manifest, not downloaded pixels. Each record is one STAC item with a download URL.",
    ];

    for (const collection of COLLECTIONS) {
      for (const aoi of AOIS) {
        const url = `${STAC_URL}?collections=${collection}&bbox=${aoi.bbox}&datetime=${start}/${end}&limit=5`;
        let features: unknown[];
        try {
          const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(45_000) });
          if (!res.ok) { errors.push(`${collection}/${aoi.id} HTTP ${res.status}`); continue; }
          features = ((await res.json()) as { features?: unknown[] }).features ?? [];
        } catch (e) { errors.push(`${collection}/${aoi.id}: ${String(e)}`); continue; }

        for (const f of features as Record<string, any>[]) {
          const props = f.properties ?? {};
          const coords = Array.isArray(f.geometry?.coordinates) ? f.geometry.coordinates : [];
          const lat = Array.isArray(coords) && typeof coords[1] === "number" ? (coords[1] as number) : null;
          const lon = Array.isArray(coords) && typeof coords[0] === "number" ? (coords[0] as number) : null;
          const assets = (f.assets ?? {}) as Record<string, { href?: string }>;
          const preferred = Object.keys(assets).find((k) => /visual|product|safe|truecolor/i.test(k)) ?? Object.keys(assets)[0];
          const download = preferred ? assets[preferred].href ?? null : null;
          records.push(record({
            id: `copernicus:${f.id ?? `${collection}-${aoi.id}-${records.length}`}`,
            source: "copernicus",
            type: "stac-item",
            title: `${collection.toUpperCase()} · ${props.datetime ?? "no date"} (${aoi.id})`,
            lat, lon,
            time: props.datetime ?? null,
            values: {
              collection,
              platform: props.platform ?? props.constellation ?? null,
              cloud_cover: props["eo:cloud_cover"] ?? null,
              bbox: Array.isArray(f.bbox) ? (f.bbox as number[]).join(",") : null,
              download_url: download,
              aoi: aoi.id,
            } as Record<string, JsonValue>,
            units: { cloud_cover: "percent" },
            url: download,
            retrieved_at,
          }));
        }
      }
    }

    if (records.length === 0) return emptyResult("copernicus", "copernicus.json", errors.length ? "failed" : "partial", errors, notes);
    return { id: "copernicus", file: "copernicus.json", status: errors.length ? "partial" : "ok", records, time_range: timeRangeOf(records), errors, notes, extra: { collections: COLLECTIONS, aois: AOIS.map((a) => a.id) } };
  } catch (error) {
    return emptyResult("copernicus", "copernicus.json", "failed", [String(error)]);
  }
}
