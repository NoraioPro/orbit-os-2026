import { fetchJson } from "../http.ts";
import { emptyResult, isoNow, record, timeRangeOf, toNumber } from "../util.ts";
import type { JsonValue, LiveRecord, SourceResult } from "../types.ts";

const EPIC_NATURAL_URL = "https://epic.gsfc.nasa.gov/api/natural";

interface EpicImage {
  image: string;
  date: string;
  caption?: string;
  identifier?: string;
  version?: string;
  centroid_coordinates?: { lat?: number; lon?: number };
}

/** NASA EPIC / DSCOVR full-disk Earth images (natural color), newest first. Keyless. */
export async function collectEpic(): Promise<SourceResult> {
  const retrieved_at = isoNow();
  try {
    const images = await fetchJson<EpicImage[]>(EPIC_NATURAL_URL, { timeoutMs: 60_000 });
    if (!Array.isArray(images) || images.length === 0) {
      return emptyResult("epic", "epic.json", "failed", ["EPIC natural API returned no images."]);
    }

    const records: LiveRecord[] = [];
    for (const img of images.slice(0, 12)) {
      const [y, m, d] = (img.date.split(" ")[0] ?? "").split("-");
      const url = `https://epic.gsfc.nasa.gov/archive/natural/${y}/${m}/${d}/png/${img.image}.png`;
      const values: Record<string, JsonValue> = {
        image: img.image,
        version: img.version ?? null,
        identifier: img.identifier ?? null,
        caption: img.caption ?? null,
        sub_lat: toNumber(img.centroid_coordinates?.lat),
        sub_lon: toNumber(img.centroid_coordinates?.lon),
        archive_png: url,
        natural_api: EPIC_NATURAL_URL,
      };
      records.push(
        record({
          id: `epic:${img.image}`,
          source: "epic",
          type: "epic-earth-image",
          title: `Full-disk Earth · ${img.date.slice(0, 10)}`,
          lat: toNumber(img.centroid_coordinates?.lat),
          lon: toNumber(img.centroid_coordinates?.lon),
          time: img.date.replace(" ", "T") + "Z",
          values,
          units: {},
          url,
          retrieved_at,
        }),
      );
    }

    return {
      id: "epic",
      file: "epic.json",
      status: "ok",
      records,
      time_range: timeRangeOf(records),
      errors: [],
      notes: [
        `NASA EPIC / DSCOVR full-disk Earth images (natural color): ${EPIC_NATURAL_URL}`,
        `Latest ${records.length} full-disk Earth images, newest first (${images[0].date.slice(0, 10)}).`,
      ],
      extra: {
        archive_base: "https://epic.gsfc.nasa.gov/archive/natural",
        latest_image: images[0].image,
        latest_date: images[0].date,
      },
    };
  } catch (error) {
    return emptyResult("epic", "epic.json", "failed", [String(error)]);
  }
}
