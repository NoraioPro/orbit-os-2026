import { USER_AGENT } from "../types.ts";
import { emptyResult, isoNow, record, timeRangeOf } from "../util.ts";
import type { JsonValue, LiveRecord, SourceResult } from "../types.ts";

const SEARCH_URL = "https://search.api.fellesdatakatalog.digdir.no/search/datasets";

// Crisis / Earth-monitoring relevant Norwegian open-data search terms.
const TERMS = ["flom", "skred", "beredskap", "krise", "værvarsel", "satellitt", "jordskjelv"];

interface FdkHit {
  id: string;
  uri?: string;
  title?: Record<string, string>;
  description?: Record<string, string>;
  isOpenData?: boolean;
  accessRights?: { code?: string };
  organization?: { name?: Record<string, string> };
}
interface FdkResponse { hits?: FdkHit[] }

/** Data.norge.no / Felles datakatalog (FDK) open-data catalog — keyless search API, server-side only (not CORS-open). */
export async function collectNorge(): Promise<SourceResult> {
  const retrieved_at = isoNow();
  const errors: string[] = [];
  const records: LiveRecord[] = [];
  const seen = new Set<string>();
  try {
    for (const term of TERMS) {
      const res = await fetch(SEARCH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", "User-Agent": USER_AGENT },
        body: JSON.stringify({ query: term, page: 0, size: 10 }),
      });
      if (!res.ok) { errors.push(`${term}: HTTP ${res.status}`); continue; }
      const data = (await res.json()) as FdkResponse;
      for (const h of data.hits ?? []) {
        if (!h.id || seen.has(h.id)) continue;
        seen.add(h.id);
        const title = h.title?.no ?? h.title?.nb ?? h.title?.en ?? Object.values(h.title ?? {})[0] ?? "Untitled";
        const values: Record<string, JsonValue> = {
          dataset_id: h.id,
          term,
          title,
          description: (h.description?.no ?? h.description?.nb ?? "") as string,
          publisher: (h.organization?.name?.no ?? h.organization?.name?.nb ?? null) as string | null,
          is_open_data: h.isOpenData ?? (h.accessRights?.code === "PUBLIC"),
          access_rights: h.accessRights?.code ?? null,
          uri: h.uri ?? null,
        };
        records.push(
          record({
            id: `fdk:${h.id}`,
            source: "norge",
            type: "open-dataset",
            title,
            lat: null,
            lon: null,
            time: null,
            values,
            units: {},
            url: h.uri ?? `https://data.norge.no/datasets/${h.id}`,
            retrieved_at,
          }),
        );
      }
    }
  } catch (error) {
    errors.push(String(error));
  }
  if (records.length === 0) {
    return emptyResult("norge", "norge-open-data.json", "failed", errors);
  }
  return {
    id: "norge",
    file: "norge-open-data.json",
    status: errors.length > 0 ? "partial" : "ok",
    records,
    time_range: timeRangeOf(records),
    errors,
    notes: [
      `Data.norge.no / Felles datakatalog (FDK) open-data catalog: ${SEARCH_URL}`,
      `Searched crisis-relevant terms (${TERMS.join(", ")}); ${records.length} unique open datasets recorded. FDK is keyless but not CORS-open, so it is harvested server-side.`,
    ],
    extra: { terms: TERMS, search_url: SEARCH_URL, license: "Norwegian Licence for Open Government Data (NLOD)" },
  };
}
