/* ------------------------------------------------------------------ *
 * disasterBoard.ts — "Disaster Watch" board: typed helpers + sample set.
 *
 * HONESTY CONTRACT (do not weaken)
 * -------------------------------
 * 1. The headline event is REAL. It is picked straight out of the
 *    harvested store (`db.events`, USGS M2.5+ past month) — place,
 *    magnitude, depth and timestamp are read off that single record
 *    and nothing is invented for it. If no earthquake qualifies, the
 *    caller must render the neutral "no qualifying live event" panel.
 * 2. Every SAR / flood / fire-impact figure below is SAMPLE: fixed-seed,
 *    hand-pinned sample values. No NISAR, Sentinel-1, ASF or EGMS
 *    product is queried, downloaded or processed in this build.
 * 3. Sample figures are never attributable to the real headline event —
 *    they are "sample impact figures, not measurements of this event".
 * ------------------------------------------------------------------ */
import { isoDay, isoMin, type EventsDB, type OrbitEvent } from './events';
import { rng } from '../modules/rng';

/* ------------------------------------------------------------------ *
 * Fixed seed — one PRNG stream so the board is identical on reload.
 * ------------------------------------------------------------------ */
export const SAMPLE_SEED = 20261115;

/** One deterministic draw sequence (0..1) from the fixed seed. */
export function sampleDraws(n: number): number[] {
  const next = rng(SAMPLE_SEED);
  return Array.from({ length: n }, () => next());
}

/** Short badge text — repeated on every card that shows a sample number. */
export const SAMPLE_NOTE = 'SAMPLE';

/** The one-line disclosure rendered under the indicator grid. */
export const SAMPLE_CLAUSE =
  'SAR change, flood extent and fire-impact areas are fixed-seed sample values — no NISAR/Sentinel-1 product is queried in this build.';

/** Stronger attribution guard shown next to the headline event. */
export const SAMPLE_ATTRIBUTION =
  'sample impact figures, not measurements of this event';

/* ------------------------------------------------------------------ *
 * Headline event — REAL, derived from the harvest. No fallbacks.
 * ------------------------------------------------------------------ */

/** Only earthquakes from the last 30 days of the dataset qualify. */
export const HEADLINE_WINDOW_DAYS = 30;

export interface HeadlineEvent {
  /** The exact store record — every printed number comes from here. */
  event: OrbitEvent;
  /** Title with the leading "M x.x - " magnitude prefix stripped. */
  place: string;
  /** Days between origin time and the dataset reference (harvest) time. */
  ageDays: number;
}

const DAY = 86400000;

/** Trim float noise without inventing precision: 18 → "18", 18.25 → "18.3". */
export function trimNum(v: number): string {
  return String(Number(v.toFixed(1)));
}

/** Magnitude shown to one decimal, as seismology convention (7 → "7.0"). */
export function fmtMag(mag: number | null): string {
  return mag === null ? '—' : mag.toFixed(1);
}

/**
 * "M 7.0 - 189 km ENE of Nagqu, China" → "189 km ENE of Nagqu, China".
 * Only the magnitude prefix is removed; the rest is the catalogue's own
 * description of the epicentre and is left untouched.
 */
export function placeFromTitle(title: string): string {
  const stripped = title.replace(/^\s*M\s?[\d.]+\s*[-–]\s*/, '').trim();
  return stripped.length ? stripped : title.trim();
}

/**
 * Strongest earthquake inside the last {@link HEADLINE_WINDOW_DAYS} days of
 * the dataset, ties broken by the most recent origin time.
 * Returns null when the store is empty, still loading, or holds no
 * qualifying earthquake — the caller then shows the neutral panel.
 */
export function pickHeadlineEvent(db: EventsDB | null): HeadlineEvent | null {
  if (!db || !db.events.length) return null;
  const ref = db.refTime;
  let best: HeadlineEvent | null = null;
  for (const e of db.events) {
    if (e.type !== 'earthquake') continue;
    if (e.mag === null || !Number.isFinite(e.mag)) continue;
    if (!Number.isFinite(e.t) || !Number.isFinite(e.lat) || !Number.isFinite(e.lon)) continue;
    const ageDays = (ref - e.t) / DAY;
    if (ageDays < 0 || ageDays > HEADLINE_WINDOW_DAYS) continue;
    const better =
      !best ||
      (e.mag > (best.event.mag ?? -Infinity)) ||
      (e.mag === best.event.mag && e.t > best.event.t);
    if (better) best = { event: e, place: placeFromTitle(e.title), ageDays };
  }
  return best;
}

/** `M7.0 · 189 km ENE of Nagqu, China · 2026-10-22 · depth 18 km`
 *  Depth is omitted entirely when the record has none. */
export function headlineLine(h: HeadlineEvent): string {
  const parts = [`M${fmtMag(h.event.mag)}`, h.place, isoDay(h.event.t)];
  if (h.event.depth !== null) parts.push(`depth ${trimNum(h.event.depth)} km`);
  return parts.join(' · ');
}

/** Real epicentre coordinates straight from the record. */
export function headlineCoords(h: HeadlineEvent): string {
  return `${h.event.lat.toFixed(3)}°, ${h.event.lon.toFixed(3)}°`;
}

/* ------------------------------------------------------------------ *
 * Sample indicator values — SAMPLE ONLY.
 * The four headline figures are pinned constants (stable on every
 * reload); the seed drives the decorative bar fills below so the whole
 * board is reproducible without inventing further claims.
 * ------------------------------------------------------------------ */
export type SampleId = 'sar' | 'flood' | 'fire' | 'confidence';

export interface SampleIndicator {
  id: SampleId;
  label: string;
  value: string;
  unit: string;
  detail: string;
  /** Seeded, purely decorative bar fill (percent). Not a measurement. */
  fillPct: number;
  icon: string;
}

const DRAWS = sampleDraws(4);
const fill = (i: number) => Math.round(24 + DRAWS[i] * 62);

export const SAMPLE_INDICATORS: SampleIndicator[] = [
  {
    id: 'sar',
    label: 'SAR backscatter change',
    value: '+4.3',
    unit: 'dB',
    detail: 'mean change over 286.4 km² of changed area',
    fillPct: fill(0),
    icon: 'Satellite',
  },
  {
    id: 'flood',
    label: 'Flood extent',
    value: '412.7',
    unit: 'km²',
    detail: 'mapped water extent · +68% vs baseline',
    fillPct: fill(1),
    icon: 'Waves',
  },
  {
    id: 'fire',
    label: 'Active fire hotspots',
    value: '126',
    unit: 'hotspots',
    detail: 'over 74.9 km² of fire-impact area',
    fillPct: fill(2),
    icon: 'Flame',
  },
  {
    id: 'confidence',
    label: 'Confidence',
    value: '92',
    unit: '%',
    detail: 'sample product confidence — not a validated score',
    fillPct: fill(3),
    icon: 'CircleCheck',
  },
];

/* ------------------------------------------------------------------ *
 * Stylized map layers — toggles change local styling only.
 * ------------------------------------------------------------------ */
export type LayerId = 'sar' | 'flood' | 'fire' | 'response';

export interface LayerToggle {
  id: LayerId;
  label: string;
  hint: string;
  icon: string;
  /** Ring diameter as a percentage of the panel width (stylized). */
  sizePct: number;
  /** Ring stroke width in px; also stylized. */
  weight: number;
}

export const LAYER_TOGGLES: LayerToggle[] = [
  { id: 'sar', label: 'SAR change', hint: 'sample · no radar scene', icon: 'Satellite', sizePct: 34, weight: 1.5 },
  { id: 'flood', label: 'Flood extent', hint: 'sample · no flood product', icon: 'Waves', sizePct: 50, weight: 1.5 },
  { id: 'fire', label: 'Fire detections', hint: 'sample · no fire product', icon: 'Flame', sizePct: 66, weight: 1.5 },
  { id: 'response', label: 'Emergency response', hint: 'stylized · no response feed', icon: 'HeartPulse', sizePct: 82, weight: 1 },
];

/** Exact wording required on the stylized map. */
export const MAP_CAPTION = 'stylized epicentre · not a basemap';

/* ------------------------------------------------------------------ *
 * Before / After / Change thumbnails — CSS gradients, no imagery.
 * ------------------------------------------------------------------ */
export interface Thumb {
  id: 'before' | 'after' | 'change';
  label: string;
  caption: string;
  gradient: string;
}

export const BEFORE_AFTER_THUMBS: Thumb[] = [
  {
    id: 'before',
    label: 'Before',
    caption: 'sample · illustrative, not an acquisition',
    gradient: 'linear-gradient(135deg,#0d2a20 0%,#16452f 45%,#0a1c17 100%)',
  },
  {
    id: 'after',
    label: 'After',
    caption: 'sample · illustrative, not an acquisition',
    gradient: 'linear-gradient(135deg,#0a1f3a 0%,#12395f 45%,#0d2a4a 100%)',
  },
  {
    id: 'change',
    label: 'Change',
    caption: 'sample · illustrative, not a difference map',
    gradient: 'linear-gradient(135deg,#1b1026 0%,#411735 45%,#5e1c2f 100%)',
  },
];

/** Badge wording for the thumbnail strip. */
export const THUMB_NOTE = 'illustrative';

/* ------------------------------------------------------------------ *
 * Change timeline — real stamps from the headline record only, plus
 * generic rows that are explicitly marked as sample product.
 * ------------------------------------------------------------------ */
export type TimelineKind = 'real' | 'sample';

export interface TimelineRow {
  id: string;
  label: string;
  detail: string;
  /** Real UTC stamp for `real` rows; a plain marker for `sample` rows. */
  stamp: string;
  kind: TimelineKind;
}

export function changeTimeline(db: EventsDB, h: HeadlineEvent): TimelineRow[] {
  const rows: TimelineRow[] = [
    {
      id: 'origin',
      label: 'Origin time',
      detail: `catalogue record · ${h.event.source}`,
      stamp: isoMin(h.event.t),
      kind: 'real',
    },
    {
      id: 'harvest',
      label: 'Harvest snapshot',
      detail: db.source === 'harvest' ? 'ORBIT collector harvest in use' : 'ORBIT shard snapshot in use',
      stamp: isoMin(db.refTime),
      kind: 'real',
    },
    {
      id: 'age',
      label: 'Age at harvest',
      detail: 'origin time → snapshot time',
      stamp: `${h.ageDays.toFixed(1)} d`,
      kind: 'real',
    },
    {
      id: 'pair',
      label: 'Radar pair acquisition',
      detail: 'sample product · no Sentinel-1 / NISAR scene was searched or ordered',
      stamp: 'not dated — sample',
      kind: 'sample',
    },
    {
      id: 'change',
      label: 'Backscatter change map',
      detail: 'sample product · the +4.3 dB / 286.4 km² figure is not from this event',
      stamp: 'not dated — sample',
      kind: 'sample',
    },
    {
      id: 'perimeter',
      label: 'Flood + fire perimeter extraction',
      detail: 'sample product · no flood or fire product was processed',
      stamp: 'not dated — sample',
      kind: 'sample',
    },
  ];
  return rows;
}

/* ------------------------------------------------------------------ *
 * Provenance — real source for the event, the rest explicitly absent.
 * ------------------------------------------------------------------ */
export interface ProvenanceEntry {
  name: string;
  url?: string;
  note?: string;
}

export const PROVENANCE_SOURCES: ProvenanceEntry[] = [
  {
    name: 'USGS earthquake catalogue (real, for the event)',
    url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php',
    note: 'M2.5+ past 30 days, via the ORBIT collector harvest',
  },
  {
    name: 'NASA ASF / NISAR L2 InSAR',
    url: 'https://search.asf.alaska.edu/',
    note: 'not connected — no product queried',
  },
  {
    name: 'Copernicus Sentinel-1 (GRD/SLC)',
    url: 'https://dataspace.copernicus.eu/',
    note: 'not connected — no product queried',
  },
];

export const PROVENANCE_CITATION =
  'Headline event: USGS ComCat record as harvested by ORBIT. Impact figures: fixed-seed sample values, not attributable to the headline event.';
