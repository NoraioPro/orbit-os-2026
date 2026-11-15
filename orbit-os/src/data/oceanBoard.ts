/**
 * Ocean Intelligence — typed access layer for /data/domains/ocean.json.
 *
 * Everything numeric in this module either comes out of the built domain file at
 * runtime or is a chart constant. Nothing here invents an observation: tiles for
 * products this build cannot source are declared once, below, with a reason and
 * no value.
 */

export const OCEAN_DATA_URL = '/data/domains/ocean.json';

/** GIBS TIME for the SST GetMap — the same fixed render date the sibling modules use. */
export const GIBS_DATE = '2026-09-01';

/* ------------------------------------------------------------------ types */

export interface OceanAoi {
  id: string;
  name: string;
  lat: number;
  lon: number;
  community?: string;
}

export interface OceanImagery {
  id: string;
  title: string;
  label: string;
  status: string;
  note?: string;
  gibs?: string;
  theme?: string;
  maxLevel?: number | null;
}

export interface OceanSeries {
  id: string;
  label: string;
  unit: string;
  months: string[];
  values: (number | null)[];
  latest: number | null;
  mean: number | null;
  note?: string;
}

export interface OceanWeather {
  id: string;
  label: string;
  unit: string;
  value: number | null;
}

export interface OceanProvenance {
  provider: string;
  url: string;
  access: string;
  honesty: string;
  note: string;
}

export interface OceanCoverage {
  start: string | null;
  end: string | null;
  window: string;
}

export interface OceanDomain {
  domain: string;
  title: string;
  subtitle: string;
  aoi: OceanAoi;
  generated_at?: string;
  provenance: OceanProvenance;
  imagery: OceanImagery[];
  series: OceanSeries[];
  weather: OceanWeather[];
  coverage: OceanCoverage;
}

/* --------------------------------------------------------------- loading */

/** Narrow the fetched JSON just enough that the UI cannot read a missing field. */
export function asOceanDomain(raw: unknown): OceanDomain {
  const d = raw as Partial<OceanDomain> | null | undefined;
  if (!d || typeof d !== 'object') throw new Error('ocean.json did not parse to an object');
  if (!d.aoi || typeof d.aoi.lat !== 'number' || typeof d.aoi.lon !== 'number') throw new Error('ocean.json is missing the AOI coordinates');
  if (!d.coverage || typeof d.coverage.window !== 'string') throw new Error('ocean.json is missing the coverage window');
  if (!Array.isArray(d.series) || d.series.length === 0) throw new Error('ocean.json carries no series');
  if (!Array.isArray(d.imagery)) throw new Error('ocean.json carries no imagery block');
  if (!d.provenance || typeof d.provenance.url !== 'string') throw new Error('ocean.json is missing provenance');
  return d as OceanDomain;
}

/** T2M = marine air temperature, WS2M = wind speed at 2 m. Both POWER, monthly. */
export function seriesById(d: OceanDomain, id: string): OceanSeries | undefined {
  return d.series.find((s) => s.id === id);
}

/** The GIBS layer id for sea-surface temperature, straight out of the domain file. */
export function sstLayer(d: OceanDomain): OceanImagery | undefined {
  return d.imagery.find((i) => i.id === 'sst' && !!i.gibs);
}

/* ------------------------------------------------------------- GIBS WMS */

/**
 * GIBS WMS 1.1.1 GetMap for an AOI window (same query shape as UnifiedGeospatial).
 * Real NASA imagery; the app never reads pixel values back out of it.
 */
export function gibsUrl(layer: string, bbox: [number, number, number, number], size = 512, date: string = GIBS_DATE) {
  const [w, s, e, n] = bbox;
  const q = new URLSearchParams({
    SERVICE: 'WMS',
    REQUEST: 'GetMap',
    VERSION: '1.1.1',
    LAYERS: layer,
    STYLES: '',
    FORMAT: 'image/png',
    TRANSPARENT: 'false',
    HEIGHT: String(size),
    WIDTH: String(size),
    SRS: 'EPSG:4326',
    BBOX: `${w},${s},${e},${n}`,
    TIME: date,
  });
  return `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?${q.toString()}`;
}

/** AOI window: ±6° latitude, ±10° longitude around the domain point (matches the sibling BBOX). */
export function aoiBBox(aoi: OceanAoi, halfLat = 6, halfLon = 10): [number, number, number, number] {
  return [aoi.lon - halfLon, aoi.lat - halfLat, aoi.lon + halfLon, aoi.lat + halfLat];
}

/* ------------------------------------------------------------ formatting */

/** A value that is not in the file is a dash — never a zero. */
export function fmt(v: number | null | undefined, digits = 1): string {
  return typeof v === 'number' && Number.isFinite(v) ? v.toFixed(digits) : '—';
}

export function coordLabel(lat: number, lon: number): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat)}°${ns} ${Math.abs(lon)}°${ew}`;
}

export const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface CoverCell {
  key: string;
  label: string;
  year: number;
  monthIndex: number;
  hasSample: boolean;
}

/**
 * Month cells for the coverage strip, derived from coverage.start → coverage.end.
 * `hasSample` is true when that month/year is one of the months the POWER series
 * actually carries (year taken from the coverage window string, e.g. "Apr–Sep 2026").
 */
export function coverageCells(d: OceanDomain, monthsWithValues: string[]): CoverCell[] {
  const parse = (s: string | null) => {
    const m = s ? /^(\d{4})-(\d{2})$/.exec(s) : null;
    return m ? { year: Number(m[1]), monthIndex: Number(m[2]) - 1 } : null;
  };
  const start = parse(d.coverage.start);
  const end = parse(d.coverage.end);
  if (!start || !end) return [];
  const yearsInWindow = (d.coverage.window.match(/\d{4}/g) ?? []).map(Number);
  const cells: CoverCell[] = [];
  let y = start.year;
  let m = start.monthIndex;
  while (y < end.year || (y === end.year && m <= end.monthIndex)) {
    const abbr = MONTH_ABBR[m];
    cells.push({
      key: `${y}-${String(m + 1).padStart(2, '0')}`,
      label: abbr,
      year: y,
      monthIndex: m,
      hasSample: monthsWithValues.includes(abbr) && yearsInWindow.includes(y),
    });
    m += 1;
    if (m > 11) {
      m = 0;
      y += 1;
    }
  }
  return cells;
}

/* ------------------------------------------------------- centre tabs */

export const CENTER_TABS = ['Currents', 'Sea surface', 'Coastal change', 'Hazards', 'Analysis'] as const;
export type CenterTab = (typeof CENTER_TABS)[number];

/** Honest copy for every tab this build cannot fill. Sea surface is the live one. */
export const TAB_NOT_CONNECTED: Record<Exclude<CenterTab, 'Sea surface'>, string> = {
  Currents:
    'No current product is connected. OSCAR surface currents and the SWOT-derived current retrievals both need a gridded delivery that this build does not fetch, so the panel shows no speed, no direction and no drift track rather than a guess.',
  'Coastal change':
    'No coastal-change product is connected. Shoreline and change detection need Landsat/Sentinel-2 analysis-ready stacks, which this build does not stage — so there is no retreat rate, no shoreline length and no example patch here.',
  Hazards:
    'No ocean hazard feed is connected. Coastal alerts, storm-surge and marine warnings have no connector in this build, so the alert counter stays empty on purpose instead of showing a zero that reads like a measured calm.',
  Analysis:
    'No analysis product is connected. Anomaly, trend-fit and marine-health indices would have to be computed from a longer baseline than the six monthly POWER samples carried here, so no derive step runs and no composite is shown.',
};

/* ------------------------------------ products with no value in this build */

export interface DisconnectedTile {
  id: string;
  label: string;
  unit: string;
  reason: string;
  /** also surfaced as a row inside the Ocean indicators panel */
  showInIndicators?: boolean;
}

export const NOT_CONNECTED: DisconnectedTile[] = [
  {
    id: 'chlorophyll',
    label: 'Chlorophyll-a',
    unit: 'mg/m³',
    reason: 'PACE / MODIS ocean-colour is a planned connector; no retrieval is fetched.',
    showInIndicators: true,
  },
  {
    id: 'currents',
    label: 'Ocean current speed',
    unit: 'm/s',
    reason: 'No OSCAR or SWOT-derived current delivery is wired up.',
    showInIndicators: true,
  },
  {
    id: 'sea-level',
    label: 'Sea-level trend',
    unit: 'mm/yr',
    reason: 'No altimetry trend product is connected; a rate needs a multi-year series.',
  },
  {
    id: 'ice-anomaly',
    label: 'Arctic sea-ice anomaly',
    unit: '%',
    reason: 'No NSIDC sea-ice extent/anomaly product is connected.',
  },
  {
    id: 'coastal-change',
    label: 'Coastal change',
    unit: 'm',
    reason: 'No Landsat / Sentinel-2 shoreline-change product is staged.',
  },
  {
    id: 'alerts',
    label: 'Coastal alerts',
    unit: 'count',
    reason: 'No coastal alert feed is connected; an empty count is not a calm sea.',
  },
  {
    id: 'marine-health',
    label: 'Marine-health index',
    unit: 'index',
    reason: 'No ecosystem or habitat index product is connected to derive it from.',
  },
];

export const NOT_CONNECTED_FOOTNOTE =
  'No ocean-colour, current, sea-level or alert product is connected in this build; those tiles carry no value on purpose.';

/* ------------------------------------------------------- collections */

export interface DataCollection {
  id: string;
  name: string;
  product: string;
  used: boolean;
  note: string;
}

/** Which NASA collections this screen actually consumes, and which it merely lists. */
export const DATA_COLLECTIONS: DataCollection[] = [
  {
    id: 'power',
    name: 'NASA POWER',
    product: 'T2M · WS2M monthly point API (community=RE)',
    used: true,
    note: 'Source of the two indicator values and both time series.',
  },
  {
    id: 'gibs',
    name: 'NASA GIBS',
    product: 'GHRSST MUR L4 sea-surface temperature',
    used: true,
    note: 'Rendered raster for the AOI window; no pixel values are read.',
  },
  {
    id: 'gpm',
    name: 'GPM',
    product: 'IMERG precipitation',
    used: true,
    note: 'Parent of POWER PRECTOTCORR, requested for this AOI.',
  },
  {
    id: 'modis-aqua',
    name: 'MODIS Aqua',
    product: 'Ocean colour / chlorophyll',
    used: false,
    note: 'Listed as the parent product; no ocean-colour retrieval is connected.',
  },
  {
    id: 'viirs',
    name: 'VIIRS',
    product: 'Ocean colour · SST',
    used: false,
    note: 'No VIIRS granule is fetched; SST is GIBS imagery only.',
  },
  {
    id: 'pace',
    name: 'PACE',
    product: 'OCI ocean colour',
    used: false,
    note: 'Planned chlorophyll connector; nothing is requested yet.',
  },
  {
    id: 'swot',
    name: 'SWOT',
    product: 'KaRIn water surface height',
    used: false,
    note: 'No SWOT product is delivered to this build.',
  },
  {
    id: 'landsat-s2',
    name: 'Landsat / Sentinel-2',
    product: 'Coastal change imagery',
    used: false,
    note: 'No analysis-ready mosaic is staged for shoreline work.',
  },
];
