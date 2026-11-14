// Loaders for the ORBIT data-collector harvest (derived by scripts/build-live.mjs into public/data/live).
import { confidenceFromP, poissonTail, trend, windowCompare, type EvidencePack, type SeriesPoint } from '../kernel';

const once = <T,>(url: string) => { let p: Promise<T> | null = null; return () => (p ??= fetch(url).then((r) => { if (!r.ok) throw new Error(`${url} HTTP ${r.status}`); return r.json() as Promise<T>; }).catch((e) => { p = null; throw e; })); };

export interface FirmsGrid { label: string; retrieved_at: string; time_range: { start: string; end: string }; detections: number; cell_deg: number; cells: [number, number, number, number, number, number][]; hottest: [number, number, string, number, string | null, string | null][]; by_satellite: Record<string, number>; notes: string[] }
export interface GibsLayer { id: string; title: string; theme: string; format: string; tms: string; max_level: number; default_time: string; template: string }
export interface GibsManifest { label: string; retrieved_at: string; capabilities_url: string; layers: GibsLayer[] }
export interface PowerHarvest { label: string; retrieved_at: string; units: Record<string, string>; notes: string[]; locations: { id: string; name: string; region: string; lat: number; lon: number; url: string; last_day: string; monthly: Record<string, Record<string, number>> }[] }
export interface SpaceHarvest { label: string; swpc: { retrieved_at: string; kp3h: [string, number][]; kp_latest_est: [string, number] | null; wind: [string, number | null, number | null][]; imf: [string, number | null, number | null][] }; donki: { retrieved_at: string; cmes: { id: string; time: string; speed: number | null; half_angle: number | null; type: string | null; url: string; note: string }[]; errors: string[] }; celestrak: { retrieved_at: string; catalog_count: number | null; sample: { name: string; norad: number; epoch: string; inc: number; mm: number; alt_km: number | null; ecc: number; reason: string }[] } }
export interface HarvestManifest { collected_at: string; collector: string; version: string; display_label: string; sources: { id: string; file: string; status: string; record_count: number; time_range: { start: string | null; end: string | null }; retrieved_at: string; errors: string[]; notes: string[] }[] }

export const loadFirms = once<FirmsGrid>('/data/live/firms-grid.json');
export const loadGibs = once<GibsManifest>('/data/live/gibs-layers.json');
export const loadPowerHarvest = once<PowerHarvest>('/data/live/power-monthly.json');
export const loadSpace = once<SpaceHarvest>('/data/live/space.json');
export const loadManifest = once<HarvestManifest>('/data/live/manifest.json');

/** GIBS WMTS template -> globe.gl tile URL function (Web Mercator, GoogleMapsCompatible). */
export function gibsTileUrl(layer: GibsLayer, time: string) {
  const ext = layer.format === 'image/png' ? 'png' : 'jpg';
  return (x: number, y: number, l: number) => {
    if (l > layer.max_level) return '';
    return layer.template.replace('{Time}', time).replace('{TileMatrixSet}', layer.tms).replace('{TileMatrix}', String(l)).replace('{TileRow}', String(y)).replace('{TileCol}', String(x)).replace(/\.jpeg$/, `.${ext === 'jpg' ? 'jpeg' : 'png'}`);
  };
}
/** True-colour composites for "today" are still filling in; use the previous full day for those. */
export function gibsTime(layer: GibsLayer) {
  if (!/true-color/.test(layer.theme)) return layer.default_time;
  const d = new Date(`${layer.default_time}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function firmsCellEvidence(g: FirmsGrid, c: FirmsGrid['cells'][number]): EvidencePack {
  const [lat, lon, n, frp, max, night] = c;
  const all = g.cells.map((x) => x[2]);
  const meanN = all.reduce((a, b) => a + b, 0) / all.length;
  const p = poissonTail(n, Math.max(meanN, 0.5));
  const conf = confidenceFromP(p);
  const hot = g.hottest.filter((h) => Math.floor(h[0]) + 0.5 === lat && Math.floor(h[1]) + 0.5 === lon);
  return {
    id: `firms:${lat}:${lon}`, title: `Active fire detections · ${lat.toFixed(1)}°, ${lon.toFixed(1)}°`, subtitle: '1° grid cell, NASA FIRMS NRT (MODIS + VIIRS)', kind: 'anomaly',
    status: 'live', statusLabel: g.label,
    sources: [{ name: 'NASA FIRMS global 24 h NRT CSVs (keyless)', url: 'https://firms.modaps.eosdis.nasa.gov/active_fire/', retrieved: g.retrieved_at }],
    window: { start: g.time_range.start.slice(0, 16).replace('T', ' '), end: g.time_range.end.slice(0, 16).replace('T', ' ') + ' UTC', label: '24-hour NRT window' },
    location: { name: `${lat.toFixed(1)}°, ${lon.toFixed(1)}°`, lat, lon, radiusKm: 55 },
    confidence: { ...conf, rationale: `Cell has ${n} detections vs a global mean of ${meanN.toFixed(1)} per active cell (Poisson tail p=${p.toExponential(1)}). Detections are thermal anomalies; industrial heat sources and volcanoes also appear.` },
    method: 'All 123k detections aggregated into 1° cells (count, total and max Fire Radiative Power). Cell intensity is compared with the global mean of active cells.',
    metrics: [
      { label: 'Detections (24 h)', value: n.toLocaleString('en-US'), status: 'live' },
      { label: 'Total FRP', value: `${frp.toLocaleString('en-US')} MW`, status: 'live' },
      { label: 'Max FRP', value: `${max} MW`, status: 'live' },
      { label: 'Night detections', value: `${night} (${Math.round((night / n) * 100)}%)`, status: 'live' },
    ],
    records: hot.slice(0, 15).map((h, i) => ({ id: `h${i}`, title: `${h[4] ?? 'sat'} detection, confidence ${h[5] ?? '?'}`, time: h[2].slice(0, 16).replace('T', ' ') + ' UTC', value: `${h[3]} MW` })),
    limitations: [`${g.label}. 24-hour window only, so no week-on-week change can be computed yet.`, 'Not an official fire perimeter or warning. FIRMS NRT is not science-quality.'],
    patterns: ['anomaly', 'fusion', 'review'], createdAt: new Date().toISOString(),
  };
}

/** Harvested daily POWER -> monthly series + last-12-months vs earlier comparison (Earth Pulse, 5-year view). */
export function harvestPowerEvidence(h: PowerHarvest, locId: string, variable: string): EvidencePack | null {
  const L = h.locations.find((l) => l.id === locId); if (!L) return null;
  const m = L.monthly[variable] ?? {};
  const keys = Object.keys(m).sort();
  const pts: SeriesPoint[] = keys.map((k) => ({ x: +k.slice(0, 4) + (+k.slice(4) - 0.5) / 12, y: m[k] }));
  // compare like-for-like: each calendar month's anomaly vs its own mean (removes seasonality)
  const clim: Record<string, number[]> = {};
  keys.forEach((k) => (clim[k.slice(4)] ??= []).push(m[k]));
  const anom: SeriesPoint[] = keys.map((k, i) => ({ x: pts[i].x, y: m[k] - clim[k.slice(4)].reduce((a, b) => a + b, 0) / clim[k.slice(4)].length }));
  const wc = windowCompare(anom, 12);
  const tr = trend(anom, 12);
  const unit = h.units[variable] ?? '';
  const level = Math.abs(wc.z) >= 2 ? 'high' : Math.abs(wc.z) >= 1 ? 'medium' : 'low';
  return {
    id: `harvest-power:${locId}:${variable}`, title: `${variable} last 12 months vs earlier · ${L.name}`, subtitle: `${L.region} · monthly means of daily NASA POWER`, kind: 'trend', status: 'live', statusLabel: h.label,
    sources: [{ name: 'NASA POWER daily point API (collector harvest)', url: L.url, retrieved: h.retrieved_at }],
    window: { start: keys[0]?.replace(/(\d{4})(\d{2})/, '$1-$2') ?? '—', end: keys[keys.length - 1]?.replace(/(\d{4})(\d{2})/, '$1-$2') ?? '—', label: 'full months only' },
    location: { name: L.name, lat: L.lat, lon: L.lon },
    confidence: { level, score: level === 'high' ? 0.8 : level === 'medium' ? 0.6 : 0.35, rationale: `Deseasonalised anomaly of the last 12 months vs the preceding ${wc.nBaseline} months: z=${wc.z.toFixed(2)}. Five years is too short for a climate trend; this is a recent-change signal.` },
    method: 'Daily → monthly means (months with ≥25 valid days). Subtract each calendar month’s 5-year mean, then compare the last 12 months with the earlier months.',
    metrics: [
      { label: 'Last 12 mo anomaly', value: `${wc.recentMean >= 0 ? '+' : ''}${wc.recentMean.toFixed(2)} ${unit}`, status: 'live' },
      { label: 'Earlier anomaly', value: `${wc.baselineMean >= 0 ? '+' : ''}${wc.baselineMean.toFixed(2)} ${unit}`, status: 'live' },
      { label: 'Shift', value: `${wc.delta >= 0 ? '+' : ''}${wc.delta.toFixed(2)} ${unit} (z=${wc.z.toFixed(1)})`, status: 'live' },
      { label: 'Theil-Sen (anomaly)', value: `${tr.theilSen >= 0 ? '+' : ''}${tr.theilSen.toFixed(3)} ${unit}/yr`, status: 'live' },
      { label: 'Months', value: String(keys.length), status: 'live' },
    ],
    series: { label: `${variable} monthly mean`, unit, points: pts },
    limitations: [`${h.label}.`, 'POWER daily dates are local solar time.', 'ALLSKY units here are kWh/m²/day (the 2001–2025 snapshot uses MJ/m²/day).'],
    patterns: ['change', 'anomaly', 'review'], createdAt: new Date().toISOString(),
  };
}

/** Map ORBIT gazetteer ids to collector POWER location ids (exact same sites only). */
export const GAZ_TO_HARVEST: Record<string, string> = { oslo: 'oslo', tromso: 'tromso', svalbard: 'svalbard', bergen: 'bergen', amazon: 'manaus', losangeles: 'los_angeles', dhaka: 'dhaka', sahel: 'niamey' };
