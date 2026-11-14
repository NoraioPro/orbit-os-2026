import { DOMParser } from "@xmldom/xmldom";
import { fetchText } from "../http.ts";
import { emptyResult, isoNow, record, timeRangeOf } from "../util.ts";
import type { JsonValue, LiveRecord, SourceResult } from "../types.ts";

const CAPABILITIES_URL =
  "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml";

const WANTED_LAYERS: { id: string; theme: string }[] = [
  { id: "MODIS_Terra_CorrectedReflectance_TrueColor", theme: "modis-true-color" },
  { id: "MODIS_Aqua_CorrectedReflectance_TrueColor", theme: "modis-true-color" },
  { id: "VIIRS_SNPP_CorrectedReflectance_TrueColor", theme: "viirs-true-color" },
  { id: "VIIRS_NOAA20_CorrectedReflectance_TrueColor", theme: "viirs-true-color" },
  { id: "GHRSST_L4_MUR_Sea_Surface_Temperature", theme: "sea-surface-temperature" },
  { id: "GHRSST_L4_MUR_Sea_Surface_Temperature_Anomalies", theme: "sea-surface-temperature" },
  { id: "MODIS_Terra_NDSI_Snow_Cover", theme: "snow-ice" },
  { id: "MODIS_Terra_Sea_Ice", theme: "snow-ice" },
  { id: "AMSRU2_Sea_Ice_Concentration_25km", theme: "snow-ice" },
  { id: "MODIS_Terra_NDVI_8Day", theme: "ndvi" },
  { id: "MODIS_Terra_L3_NDVI_16Day", theme: "ndvi" },
  { id: "VIIRS_SNPP_NDVI_8Day", theme: "ndvi" },
  { id: "VIIRS_NOAA20_NDVI_8Day", theme: "ndvi" },
];

function localName(tag: string): string {
  const i = tag.indexOf("}");
  const raw = i >= 0 ? tag.slice(i + 1) : tag;
  const colon = raw.indexOf(":");
  return colon >= 0 ? raw.slice(colon + 1) : raw;
}

function elementChildren(el: Element): Element[] {
  const out: Element[] = [];
  const nodes = el.childNodes;
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node && node.nodeType === 1) out.push(node as Element);
  }
  return out;
}

function children(el: Element, name: string): Element[] {
  return elementChildren(el).filter((c) => localName(c.tagName) === name);
}

function child(el: Element, name: string): Element | undefined {
  return children(el, name)[0];
}

function textOf(el: Element | undefined, name?: string): string | null {
  if (!el) return null;
  if (!name) return (el.textContent ?? "").trim() || null;
  return child(el, name)?.textContent?.trim() || null;
}

function descendantElements(root: { getElementsByTagName: (n: string) => unknown }): Element[] {
  const list = root.getElementsByTagName("*") as { length: number; item: (i: number) => Element | null } | Element[];
  const out: Element[] = [];
  const len = Array.isArray(list) ? list.length : list.length;
  for (let i = 0; i < len; i++) {
    const el = Array.isArray(list) ? list[i] : list.item(i);
    if (el) out.push(el);
  }
  return out;
}

interface ParsedLayer {
  id: string;
  title: string | null;
  abstract: string | null;
  formats: string[];
  tileMatrixSets: string[];
  defaultTime: string | null;
  timeValuesHead: string | null;
  templates: { format: string | null; template: string | null }[];
}

function parseLayers(xml: string): Map<string, ParsedLayer> {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const map = new Map<string, ParsedLayer>();
  const all = descendantElements(doc).filter((el) => localName(el.tagName) === "Layer");
  for (const layer of all) {
    const id = textOf(layer, "Identifier");
    if (!id) continue;
    const formats = children(layer, "Format").map((f) => f.textContent?.trim() || "").filter(Boolean);
    const tileMatrixSets = children(layer, "TileMatrixSetLink")
      .map((link) => textOf(link, "TileMatrixSet"))
      .filter((v): v is string => Boolean(v));
    const templates = children(layer, "ResourceURL")
      .filter((ru) => (ru.getAttribute("resourceType") ?? "tile") === "tile")
      .map((ru) => ({ format: ru.getAttribute("format"), template: ru.getAttribute("template") }))
      .filter((ru) => Boolean(ru.template) && (ru.template ?? "").includes("{Time}"));
    // Fall back to any tile template if a timed one is missing.
    if (templates.length === 0) {
      templates.push(
        ...children(layer, "ResourceURL")
          .filter((ru) => (ru.getAttribute("resourceType") ?? "tile") === "tile")
          .map((ru) => ({ format: ru.getAttribute("format"), template: ru.getAttribute("template") })),
      );
    }
    let defaultTime: string | null = null;
    let timeValuesHead: string | null = null;
    for (const dim of children(layer, "Dimension")) {
      const dimId = textOf(dim, "Identifier");
      if (dimId !== "Time") continue;
      defaultTime = textOf(dim, "Default");
      timeValuesHead = (textOf(dim, "Value") ?? "").slice(0, 200) || null;
    }
    map.set(id, {
      id,
      title: textOf(layer, "Title"),
      abstract: textOf(layer, "Abstract"),
      formats,
      tileMatrixSets,
      defaultTime,
      timeValuesHead,
      templates,
    });
  }
  return map;
}

export async function collectGibs(): Promise<SourceResult> {
  const retrieved_at = isoNow();
  try {
    const { body } = await fetchText(CAPABILITIES_URL, { timeoutMs: 90_000, accept: "application/xml,text/xml,*/*" });
    const layers = parseLayers(body);
    const notes: string[] = [
      `NASA GIBS WMTS GetCapabilities (EPSG:3857 / Web Mercator 'best' endpoint): ${CAPABILITIES_URL}`,
      "This file is a layer manifest for the globe, not a set of observations. Each record is one useful imagery layer.",
    ];
    const errors: string[] = [];
    const records: LiveRecord[] = [];

    for (const wanted of WANTED_LAYERS) {
      const layer = layers.get(wanted.id);
      if (!layer) {
        errors.push(`Layer not found in GetCapabilities: ${wanted.id}`);
        continue;
      }
      const template = layer.templates[0]?.template ?? null;
      const format = layer.templates[0]?.format ?? layer.formats[0] ?? null;
      const tms = layer.tileMatrixSets[0] ?? null;
      const values: Record<string, JsonValue> = {
        layer_id: layer.id,
        theme: wanted.theme,
        title: layer.title,
        abstract: layer.abstract,
        format,
        tile_matrix_set: tms,
        tile_matrix_sets: layer.tileMatrixSets,
        default_time: layer.defaultTime,
        time_values_head: layer.timeValuesHead,
        wmts_template: template,
        capabilities_url: CAPABILITIES_URL,
        example_tile_url:
          template && tms
            ? template
                .replace("{Time}", layer.defaultTime ?? "default")
                .replace("{TileMatrixSet}", tms)
                .replace("{TileMatrix}", "0")
                .replace("{TileRow}", "0")
                .replace("{TileCol}", "0")
            : null,
      };
      records.push(
        record({
          id: `gibs:${layer.id}`,
          source: "gibs",
          type: "wmts-layer",
          title: layer.title ?? layer.id,
          lat: null,
          lon: null,
          time: layer.defaultTime,
          values,
          units: {},
          url: template ?? CAPABILITIES_URL,
          retrieved_at,
        }),
      );
    }

    notes.push(`Parsed ${layers.size} layers from GetCapabilities; selected ${records.length} for the globe.`);

    if (records.length === 0) {
      return emptyResult("gibs", "gibs-layers.json", "failed", errors, notes);
    }

    return {
      id: "gibs",
      file: "gibs-layers.json",
      status: errors.length > 0 ? "partial" : "ok",
      records,
      time_range: timeRangeOf(records),
      errors,
      notes,
      extra: {
        capabilities_url: CAPABILITIES_URL,
        capabilities_layer_count: layers.size,
      },
    };
  } catch (error) {
    return emptyResult("gibs", "gibs-layers.json", "failed", [String(error)]);
  }
}
