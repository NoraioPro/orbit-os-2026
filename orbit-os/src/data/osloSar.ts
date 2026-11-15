/* ------------------------------------------------------------------ *
 * osloSar.ts — Oslo infrastructure SAR / InSAR demo dataset.
 *
 * HONESTY CONTRACT (do not weaken)
 * -------------------------------
 * Every displacement number, acquisition record, processing job and
 * acquisition "thumbnail" in this file is SYNTHETIC. It is generated
 * from one fixed seed so the layout is stable across reloads — it is
 * NOT a measurement, NOT a fetched catalogue result, and NOT a HyP3
 * job log. No NISAR, Sentinel-1, ASF, EGMS or Copernicus product has
 * been downloaded in this build.
 *
 * Real data types this module *describes* (and does not contain):
 *   · NISAR L2 InSAR (LOS)   — NASA ASF / Earthdata   (not connected)
 *   · Sentinel-1 GRD / SLC   — Copernicus, via ASF / EGMS (not connected)
 *   · Copernicus DEM 30 m    — reference DEM          (not connected)
 * The geographic AOI (Oslo, Norway) is real. The AOI *extent*, asset
 * positions, deformation field and scale bar are stylized.
 * ------------------------------------------------------------------ */
import { rng } from '../modules/rng';

/** Fixed seed — same numbers on every reload, obviously reproducible. */
export const OSLO_SEED = 20261115;

/** Short badge text, used on every panel that shows a synthetic number. */
export const DEMO_NOTE = 'concept demo — not a measurement';

/** Long-form honesty clause shown in the provenance/metadata panel. */
export const DEMO_CLAUSE =
  'Displacement product is SAMPLE and not connected in this build. The real data types — NISAR L2 InSAR via ASF and Sentinel-1 (GRD/SLC) via ASF / EGMS — are listed for reference only; no product was queried, downloaded or processed.';

export const AOI = {
  name: 'Oslo, Norway',
  lat: 59.9139,
  lon: 10.7522,
  /** Stated plainly because the mapped extent is illustrative. */
  extentNote: 'AOI extent stylized — the footprint is not georeferenced',
} as const;

/* ------------------------------------------------------------------ *
 * LOS displacement legend (mm)
 * Negative = movement away from the satellite (subsidence / settling).
 * Positive = movement toward the satellite. Red → blue ramp.
 * ------------------------------------------------------------------ */
export interface LosStop {
  /** Upper bound of the bin, in mm (last stop is ≥ +30). */
  value: number;
  label: string;
  color: string;
}

export const LOS_LEGEND: LosStop[] = [
  { value: -30, label: '≤ −30', color: '#b91c1c' },
  { value: -20, label: '−20', color: '#e11d48' },
  { value: -10, label: '−10', color: '#f97316' },
  { value: -5, label: '−5', color: '#fbbf24' },
  { value: 0, label: '0', color: '#6b7280' },
  { value: 5, label: '+5', color: '#38bdf8' },
  { value: 10, label: '+10', color: '#0ea5e9' },
  { value: 30, label: '≥ +30', color: '#1d4ed8' },
];

/** Bin colour for a LOS displacement value (same bins as LOS_LEGEND). */
export function losColor(mm: number): string {
  for (const stop of LOS_LEGEND) if (mm <= stop.value) return stop.color;
  return LOS_LEGEND[LOS_LEGEND.length - 1].color;
}

/* ------------------------------------------------------------------ *
 * Monitored assets (positions are percent of the stylized map panel)
 * ------------------------------------------------------------------ */
export type Severity = 'low' | 'moderate' | 'high';
export type AssetKind = 'Dam' | 'Bridge' | 'Road corridor' | 'Industrial zone';

export interface LosAsset {
  id: string;
  name: string;
  shortName: string;
  kind: AssetKind;
  /** LOS displacement, mm. Negative = away from satellite. */
  displacementMm: number;
  /** 1σ uncertainty, mm. */
  uncertaintyMm: number;
  /** Mean temporal coherence, 0–1. */
  coherence: number;
  severity: Severity;
  /** Stylized position inside the demo panel, percent of width / height. */
  x: number;
  y: number;
  /** Radius of the illustrative heat blob, percent of panel width. */
  blobWidth: number;
}

export const LOS_ASSETS: LosAsset[] = [
  { id: 'dam', name: 'Maridalsvannet Dam', shortName: 'Maridalsvannet Dam', kind: 'Dam', displacementMm: -3.1, uncertaintyMm: 1.9, coherence: 0.86, severity: 'low', x: 24, y: 20, blobWidth: 26 },
  { id: 'akerselva', name: 'Akerselva Bridge', shortName: 'Akerselva Bridge', kind: 'Bridge', displacementMm: -12.4, uncertaintyMm: 3.1, coherence: 0.81, severity: 'moderate', x: 55, y: 46, blobWidth: 40 },
  { id: 'haraldrud', name: 'Haraldrud Industrial', shortName: 'Haraldrud Industrial', kind: 'Industrial zone', displacementMm: -8.9, uncertaintyMm: 2.6, coherence: 0.74, severity: 'low', x: 39, y: 74, blobWidth: 34 },
  { id: 'e6', name: 'E6 Corridor', shortName: 'E6 Corridor', kind: 'Road corridor', displacementMm: -23.6, uncertaintyMm: 3.8, coherence: 0.78, severity: 'high', x: 74, y: 64, blobWidth: 54 },
];

/** −23.6 mm — the E6 corridor value above (always sample data). */
export const MAX_DISPLACEMENT_MM = Math.min(...LOS_ASSETS.map((a) => a.displacementMm));
/** Assets flagged moderate or high (2 in this demo). */
export const CONCERN_COUNT = LOS_ASSETS.filter((a) => a.severity !== 'low').length;
export const INFRASTRUCTURE_TYPES = ['Bridges', 'Roads', 'Dams', 'Industry'] as const;

/* ------------------------------------------------------------------ *
 * KPI strip
 * ------------------------------------------------------------------ */
export type KpiTone = 'sky' | 'amber' | 'rose' | 'emerald' | 'slate' | 'violet';

export interface KpiCard {
  id: string;
  label: string;
  value: string;
  sub: string;
  tone: KpiTone;
  icon: string;
}

export const KPIS: KpiCard[] = [
  { id: 'scenes', label: 'SAR Scenes', value: '12', sub: '+3 new', tone: 'sky', icon: 'Satellite' },
  { id: 'types', label: 'Infrastructure Types', value: '4', sub: 'Bridges · Roads · Dams · Industry', tone: 'slate', icon: 'Building2' },
  { id: 'maxdef', label: 'Max Deformation', value: `−${Math.abs(MAX_DISPLACEMENT_MM).toFixed(1)} mm`, sub: 'LOS · ±3.8 mm (1σ)', tone: 'rose', icon: 'Activity' },
  { id: 'concern', label: 'Areas of Concern', value: String(CONCERN_COUNT), sub: '2 above 10 mm threshold', tone: 'amber', icon: 'TriangleAlert' },
  { id: 'jobs', label: 'Processing Jobs', value: '5', sub: '2 running (sim) · 3 complete (sim)', tone: 'violet', icon: 'Cpu' },
];

/* ------------------------------------------------------------------ *
 * Map panel tabs + layer list
 * ------------------------------------------------------------------ */
export type PanelTab = 'map' | 'sar' | 'insar' | 'change' | 'elevation';

export const PANEL_TABS: { id: PanelTab; label: string }[] = [
  { id: 'map', label: 'Map' },
  { id: 'sar', label: 'SAR' },
  { id: 'insar', label: 'InSAR' },
  { id: 'change', label: 'Change' },
  { id: 'elevation', label: 'Elevation' },
];

/** Honest placeholders — these tabs are not built out in this demo. */
export const TAB_NOTES: Record<Exclude<PanelTab, 'map'>, { icon: string; text: string }> = {
  sar: {
    icon: 'Satellite',
    text: 'The SAR amplitude view is not loaded in this build. It would paint a backscatter mosaic (σ⁰, dB) from NISAR L-band or Sentinel-1 C-band GRD scenes — no raster is bundled or streamed here.',
  },
  insar: {
    icon: 'Waves',
    text: 'The InSAR interferogram view is not loaded in this build. It would show wrapped phase fringes or a displacement field derived from a NISAR L2 / Sentinel-1 SLC pair — nothing is unwrapped, filtered or geocoded here.',
  },
  change: {
    icon: 'Ratio',
    text: 'The multi-date change view is not loaded in this build. It would compare coherence or backscatter across acquisition dates to flag surface change — no co-registration has been run.',
  },
  elevation: {
    icon: 'Mountain',
    text: 'The elevation view is not loaded in this build. It would render Copernicus DEM 30 m relief for context on slope and line-of-sight geometry — no DEM tiles are fetched.',
  },
};

export type LayerId = 'deformation' | 'infrastructure' | 'footprints' | 'dem' | 'urban' | 'water';

export interface LayerRow {
  id: LayerId;
  label: string;
  detail?: string;
  checked: boolean;
}

export const LAYERS: LayerRow[] = [
  { id: 'deformation', label: 'SAR Deformation (LOS)', detail: 'sample field', checked: true },
  { id: 'infrastructure', label: 'Infrastructure', detail: 'Bridges · Roads · Dams · Industrial Zones', checked: true },
  { id: 'footprints', label: 'Satellite Footprints', detail: 'stylized swaths', checked: false },
  { id: 'dem', label: 'Elevation (DEM)', detail: 'contours only', checked: false },
  { id: 'urban', label: 'Urban Areas', checked: false },
  { id: 'water', label: 'Water Bodies', checked: false },
];

/** Initial checkbox state, keyed for easy `useState` seeding. */
export const LAYER_DEFAULTS: Record<LayerId, boolean> = LAYERS.reduce(
  (acc, l) => ({ ...acc, [l.id]: l.checked }),
  {} as Record<LayerId, boolean>,
);

/* ------------------------------------------------------------------ *
 * Satellite acquisitions (illustrative records — nothing was queried)
 * ------------------------------------------------------------------ */
export const SPECKLE_COLS = 12;
export const SPECKLE_ROWS = 8;

export interface Acquisition {
  id: string;
  mission: string;
  band: string;
  /** Illustrative acquisition date — not harvested from a catalogue. */
  date: string;
  product: string;
  resolution: string;
  /** Deterministic speckle placeholder (0–1), drawn as CSS, never a photo. */
  speckle: number[];
}

function speckle(seed: number): number[] {
  const r = rng(seed);
  return Array.from({ length: SPECKLE_COLS * SPECKLE_ROWS }, () => Math.round((0.12 + r() * 0.8) * 100) / 100);
}

export const ACQUISITIONS: Acquisition[] = [
  { id: 'nisar', mission: 'NISAR', band: 'L-band', date: '2026-11-13', product: 'L2', resolution: '12 m', speckle: speckle(OSLO_SEED + 11) },
  { id: 'nisar-ref', mission: 'NISAR', band: 'L-band', date: '2026-11-01', product: 'L2 (reference)', resolution: '12 m', speckle: speckle(OSLO_SEED + 12) },
  { id: 's1a', mission: 'Sentinel-1A', band: 'C-band', date: '2026-11-09', product: 'GRD', resolution: '10 m', speckle: speckle(OSLO_SEED + 22) },
  { id: 's1c', mission: 'Sentinel-1C', band: 'C-band', date: '2026-10-28', product: 'GRD', resolution: '10 m', speckle: speckle(OSLO_SEED + 33) },
];

/* ------------------------------------------------------------------ *
 * Deformation time series (synthetic, fixed seed)
 * ------------------------------------------------------------------ */
export interface SeriesPointXY {
  x: number;
  y: number;
}

export interface TimeSeries {
  id: 'e6' | 'akerselva' | 'dam';
  label: string;
  color: string;
  points: SeriesPointXY[];
}

export const TS_MONTHS = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'] as const;
/** Fixed y-axis ticks in mm, as designed on the board. */
export const TS_Y_TICKS = [10, 0, -10, -20, -30] as const;
export const TS_Y_MIN = -30;
export const TS_Y_MAX = 10;

const SERIES_SPEC: { id: TimeSeries['id']; label: string; color: string; from: number; to: number }[] = [
  // Endpoints lock to the asset table so the chart and the callouts agree.
  { id: 'e6', label: 'E6 Corridor', color: '#f87171', from: -3.4, to: -23.6 },
  { id: 'akerselva', label: 'Akerselva Bridge', color: '#38bdf8', from: -1.8, to: -12.4 },
  { id: 'dam', label: 'Maridalsvannet Dam', color: '#34d399', from: -0.4, to: -3.1 },
];

export const TIME_SERIES: TimeSeries[] = (() => {
  const r = rng(OSLO_SEED);
  const last = TS_MONTHS.length - 1;
  return SERIES_SPEC.map((s) => ({
    id: s.id,
    label: s.label,
    color: s.color,
    points: TS_MONTHS.map((_, i) => {
      const t = i / last;
      // Jitter only between the endpoints so the anchors stay exact.
      const jitter = i === 0 || i === last ? 0 : (r() - 0.5) * Math.abs(s.to - s.from) * 0.16;
      return { x: i, y: Number((s.from + (s.to - s.from) * t + jitter).toFixed(1)) };
    }),
  }));
})();

/* ------------------------------------------------------------------ *
 * Processing jobs (simulated queue — 5 total, panel shows the first 3)
 * ------------------------------------------------------------------ */
export interface ProcessingJob {
  id: string;
  label: string;
  state: 'running' | 'completed';
  /** 0–100 */
  progress: number;
  detail: string;
}

export const PROCESSING_JOBS: ProcessingJob[] = [
  { id: 'job-insar', label: 'InSAR Displacement (NISAR pair)', state: 'running', progress: 72, detail: 'Running · 4 min remaining' },
  { id: 'job-rtc', label: 'RTC & Backscatter (Sentinel-1)', state: 'completed', progress: 100, detail: 'Completed · 2 min ago' },
  { id: 'job-change', label: 'Change Detection (Multi-date)', state: 'completed', progress: 100, detail: 'Completed · 6 min ago' },
  { id: 'job-coh', label: 'Coherence Mask (NISAR pair)', state: 'running', progress: 88, detail: 'Running · 1 min remaining' },
  { id: 'job-grid', label: 'Subsidence Grid (Sentinel-1)', state: 'completed', progress: 100, detail: 'Completed · 11 min ago' },
];

export const JOBS_SHOWN = 3;

/* ------------------------------------------------------------------ *
 * Uncertainty / quality + provenance metadata
 * ------------------------------------------------------------------ */
export interface QualityRow {
  label: string;
  value: string;
  tone: 'sky' | 'emerald' | 'slate' | 'amber';
}

export const QUALITY: QualityRow[] = [
  { label: 'Estimated Uncertainty (1σ)', value: '±3.8 mm', tone: 'sky' },
  { label: 'Coherence (mean)', value: '0.78', tone: 'sky' },
  { label: 'Data Quality', value: 'Good', tone: 'emerald' },
  { label: 'Method', value: 'InSAR (L-band)', tone: 'slate' },
];

export interface MetaRow {
  label: string;
  value: string;
}

export const PROVENANCE_META: MetaRow[] = [
  { label: 'Data Source', value: 'NASA ASF / NISAR' },
  { label: 'Product', value: 'NISAR L2 InSAR (LOS)' },
  { label: 'Acquisition', value: '2026-11-13 09:24:17 UTC' },
  { label: 'Processing', value: 'HyP3 · InSAR · v2.5' },
  { label: 'Reference DEM', value: 'Copernicus DEM (30 m)' },
  { label: 'License', value: 'NASA Earthdata (Open)' },
];

/* ------------------------------------------------------------------ *
 * Bottom strip: analysis tiles + analyst card copy
 * ------------------------------------------------------------------ */
export interface AnalysisTile {
  id: string;
  label: string;
  icon: string;
  hint: string;
}

export const ANALYSIS_TILES: AnalysisTile[] = [
  { id: 'stability', label: 'Infrastructure Stability', icon: 'ShieldCheck', hint: 'LOS displacement ranking across all monitored assets.' },
  { id: 'subsidence', label: 'Subsidence Monitoring', icon: 'Waves', hint: 'Long-baseline settlement trend per asset.' },
  { id: 'bridge', label: 'Bridge Health', icon: 'HeartPulse', hint: 'Deck and foundation displacement, coherence-gated.' },
  { id: 'dam', label: 'Dam Safety', icon: 'Droplets', hint: 'Embankment creep and seasonal water load.' },
  { id: 'road', label: 'Road Corridors', icon: 'Compass', hint: 'Corridor-wide differential settlement.' },
  { id: 'industrial', label: 'Industrial Sites', icon: 'Building2', hint: 'Ground settlement under heavy structures.' },
];

export const ANALYST_COPY = 'Explain changes, assess risk, and suggest next actions.';

/** Earthdata account card copy (design text) + the honest caveat. */
export const EARTHDATA_CARD = {
  title: 'NASA Earthdata',
  state: 'Not authenticated (demo session)',
  detail: 'Earthdata Login · NISAR / ASF / HyP3 — the path this board will use',
  caveat: 'No live Earthdata login is opened in this build, so no protected product is reachable from this page. Nothing below was fetched from ASF.',
} as const;

/** Panel footers — kept here so the wording stays identical everywhere. */
export const FOOTERS = {
  acquisitions: 'Illustrative acquisition records (demo) — no catalogue query was made; missions, dates, products and resolutions are placeholders.',
  timeseries: 'Synthetic series from a fixed seed. Anchored to the sample asset table above; not a measured displacement history and not a velocity estimate.',
  jobs: `Simulated job queue — showing ${JOBS_SHOWN} of ${PROCESSING_JOBS.length} jobs; no HyP3 job was submitted.`,
  map: 'Stylized AOI · demo — hand-placed heat blobs, not a raster, not a basemap. No georeferencing; the 5 km scale bar is indicative only.',
  layers: 'Layer toggles re-draw local stylized shapes; no layer is fetched from a tile service.',
} as const;

/** Provenance strip sources — real data types, explicitly not connected. */
export const PROVENANCE_SOURCES = [
  { name: 'NASA Earthdata', note: 'NISAR · OPERA · ARIA · UAVSAR — not connected in this build' },
  { name: 'Copernicus', note: 'Sentinel-1/2 — not connected in this build' },
  { name: 'ASF Vertex', note: 'no query made' },
  { name: 'HyP3', note: 'no job submitted' },
  { name: 'Copernicus DEM', note: 'reference DEM, not loaded' },
  { name: 'OpenStreetMap', note: 'infrastructure context, not loaded' },
];

export const PROVENANCE_CITATION =
  'NASA Earthdata (NISAR, OPERA, ARIA, UAVSAR) · Copernicus (Sentinel-1/2) · ASF Vertex · HyP3 · Copernicus DEM · OpenStreetMap';
