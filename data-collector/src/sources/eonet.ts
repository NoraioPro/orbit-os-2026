import { fetchJson, HttpError } from "../http.ts";
import {
  asString,
  isoNow,
  pointFromGeometry,
  record,
  timeRangeOf,
  emptyResult,
} from "../util.ts";
import type { JsonValue, LiveRecord, SourceResult } from "../types.ts";

const OPEN_URL = "https://eonet.gsfc.nasa.gov/api/v3/events?status=open";
const RECENT_URL = "https://eonet.gsfc.nasa.gov/api/v3/events?status=all&days=30";
// Short-lived categories (floods/storms/volcanoes/ice) close quickly, so "open" alone under-represents them.
// Pull their full history so the catalogue is rich, not just currently-ongoing events.
const HISTORICAL_CATEGORIES = ["floods", "severeStorms", "volcanoes", "seaLakeIce"];
const historyUrl = (cat: string) =>
  `https://eonet.gsfc.nasa.gov/api/v3/events?status=all&category=${cat}&start=2002-01-01&end=${isoNow().slice(0, 10)}&limit=2000`;

interface EonetGeometry {
  magnitudeValue?: number | null;
  magnitudeUnit?: string | null;
  date?: string;
  type?: string;
  coordinates?: unknown;
}

interface EonetEvent {
  id: string;
  title?: string;
  description?: string | null;
  link?: string;
  closed?: string | null;
  categories?: { id?: string; title?: string }[];
  sources?: { id?: string; url?: string }[];
  geometry?: EonetGeometry[];
}

interface EonetResponse {
  title?: string;
  events?: EonetEvent[];
}

export async function collectEonet(): Promise<SourceResult> {
  const retrieved_at = isoNow();
  const errors: string[] = [];
  const notes: string[] = [];
  const byId = new Map<string, EonetEvent & { _feeds: string[] }>();

  async function pull(label: string, url: string): Promise<number> {
    try {
      const data = await fetchJson<EonetResponse>(url, { timeoutMs: 90_000 });
      const events = data.events ?? [];
      for (const ev of events) {
        if (!ev?.id) continue;
        const existing = byId.get(ev.id);
        if (existing) {
          existing._feeds.push(label);
        } else {
          byId.set(ev.id, { ...ev, _feeds: [label] });
        }
      }
      notes.push(`${label}: ${events.length} events from ${url}`);
      return events.length;
    } catch (error) {
      const message = error instanceof HttpError ? error.message : String(error);
      errors.push(`${label} failed: ${message}`);
      return 0;
    }
  }

  const [openCount, recentCount, ...histCounts] = await Promise.all([
    pull("open", OPEN_URL),
    pull("recent_30d", RECENT_URL),
    ...HISTORICAL_CATEGORIES.map((c) => pull(`hist_${c}`, historyUrl(c))),
  ]);

  if (byId.size === 0) {
    return emptyResult(
      "eonet",
      "eonet.json",
      errors.length > 0 ? "failed" : "failed",
      errors.length > 0 ? errors : ["EONET returned no events"],
      notes,
    );
  }

  const records: LiveRecord[] = [];
  for (const ev of byId.values()) {
    const geometries = ev.geometry ?? [];
    const lastGeom = geometries.length > 0 ? geometries[geometries.length - 1] : undefined;
    const point = lastGeom ? pointFromGeometry(lastGeom) : { lat: null, lon: null };
    const categories = (ev.categories ?? []).map((c) => c.title ?? c.id).filter(Boolean);
    const primaryType = ev.categories?.[0]?.id ?? "natural-event";
    const values: Record<string, JsonValue> = {
      event_id: ev.id,
      categories,
      description: ev.description ?? null,
      closed: ev.closed ?? null,
      open: ev.closed == null,
      feeds: ev._feeds,
      source_ids: (ev.sources ?? []).map((s) => s.id ?? "").filter(Boolean),
      geometry_count: geometries.length,
    };
    const units: Record<string, string> = {};
    if (lastGeom?.magnitudeValue != null) {
      values.magnitude = lastGeom.magnitudeValue;
      if (lastGeom.magnitudeUnit) units.magnitude = lastGeom.magnitudeUnit;
    }
    records.push(
      record({
        id: ev.id,
        source: "eonet",
        type: String(primaryType),
        title: ev.title ?? ev.id,
        lat: point.lat,
        lon: point.lon,
        time: asString(lastGeom?.date) ?? ev.closed ?? null,
        values,
        units,
        url: ev.link ?? `https://eonet.gsfc.nasa.gov/api/v3/events/${ev.id}`,
        retrieved_at,
      }),
    );
  }

  const histSummary = HISTORICAL_CATEGORIES.map((c, i) => `${c}=${histCounts[i] ?? 0}`).join(", ");
  notes.push(`Merged unique events: ${records.length} (open=${openCount}, recent_30d=${recentCount}; historical ${histSummary})`);
  const status = errors.length > 0 ? "partial" : "ok";
  return {
    id: "eonet",
    file: "eonet.json",
    status,
    records,
    time_range: timeRangeOf(records),
    errors,
    notes,
  };
}
