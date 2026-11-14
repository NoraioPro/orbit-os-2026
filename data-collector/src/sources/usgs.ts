import { fetchJson } from "../http.ts";
import {
  asString,
  isoNow,
  pointFromCoordinates,
  record,
  timeRangeOf,
  toNumber,
  emptyResult,
} from "../util.ts";
import type { JsonValue, LiveRecord, SourceResult } from "../types.ts";

const URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_month.geojson";

interface UsgsFeature {
  id?: string;
  properties?: {
    mag?: number | null;
    place?: string;
    time?: number;
    updated?: number;
    url?: string;
    detail?: string;
    tsunami?: number;
    sig?: number;
    net?: string;
    code?: string;
    status?: string;
    type?: string;
    title?: string;
    felt?: number | null;
    cdi?: number | null;
    mmi?: number | null;
    alert?: string | null;
    dmin?: number | null;
    rms?: number | null;
    gap?: number | null;
    magType?: string | null;
  };
  geometry?: { type?: string; coordinates?: unknown };
}

interface UsgsResponse {
  metadata?: { title?: string; count?: number; url?: string; generated?: number };
  features?: UsgsFeature[];
}

export async function collectUsgs(): Promise<SourceResult> {
  const retrieved_at = isoNow();
  try {
    const data = await fetchJson<UsgsResponse>(URL, { timeoutMs: 90_000 });
    const features = data.features ?? [];
    const records: LiveRecord[] = [];

    for (const feature of features) {
      const props = feature.properties ?? {};
      const coords = feature.geometry?.coordinates;
      const point = pointFromCoordinates(coords);
      const depth = Array.isArray(coords) ? toNumber(coords[2]) : null;
      const time =
        typeof props.time === "number" ? new Date(props.time).toISOString() : null;
      const values: Record<string, JsonValue> = {
        magnitude: props.mag ?? null,
        magnitude_type: props.magType ?? null,
        place: props.place ?? null,
        depth_km: depth,
        tsunami: props.tsunami ?? 0,
        significance: props.sig ?? null,
        felt: props.felt ?? null,
        alert: props.alert ?? null,
        review_status: props.status ?? null,
        event_type: props.type ?? "earthquake",
        network: props.net ?? null,
      };
      records.push(
        record({
          id: feature.id ?? asString(props.code) ?? `usgs-${props.time}`,
          source: "usgs",
          type: props.type ?? "earthquake",
          title: props.title ?? (props.place ? `M${props.mag} - ${props.place}` : "Earthquake"),
          lat: point.lat,
          lon: point.lon,
          time,
          values,
          units: { magnitude: "Mw-equivalent", depth_km: "km" },
          url: props.url ?? URL,
          retrieved_at,
        }),
      );
    }

    return {
      id: "usgs",
      file: "usgs-earthquakes.json",
      status: "ok",
      records,
      time_range: timeRangeOf(records),
      errors: [],
      notes: [
        "Feed: USGS Magnitude 2.5+ Earthquakes, Past Month (FDSN GeoJSON).",
        `API metadata count: ${data.metadata?.count ?? "n/a"}`,
      ],
    };
  } catch (error) {
    return emptyResult("usgs", "usgs-earthquakes.json", "failed", [String(error)]);
  }
}
