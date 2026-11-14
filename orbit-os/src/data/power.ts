import gazetteer from './gazetteer.json';
import { annualFromPowerMonthly, trend, type DataStatus, type SeriesPoint } from '../kernel';

export interface Place { id: string; name: string; country: string; lat: number; lon: number; aliases: string[] }
export const PLACES = gazetteer as Place[];

export const POWER_VARS: Record<string, { label: string; unit: string; short: string; note: string }> = {
  T2M: { label: 'Air temperature at 2 m', unit: '°C', short: 'Temperature', note: 'MERRA-2 reanalysis via NASA POWER' },
  PRECTOTCORR: { label: 'Precipitation (bias-corrected)', unit: 'mm/day', short: 'Precipitation', note: 'MERRA-2 corrected precipitation via NASA POWER (GPM IMERG is the planned higher-resolution source)' },
  GWETROOT: { label: 'Root-zone soil wetness', unit: '0–1', short: 'Soil wetness', note: 'MERRA-2 root-zone wetness via NASA POWER: a proxy until SMAP L3/L4 is connected. Undefined over ocean.' },
  ALLSKY_SFC_SW_DWN: { label: 'All-sky surface shortwave', unit: 'MJ/m²/day', short: 'Solar', note: 'CERES/MERRA-2 via NASA POWER' },
};

interface Snapshot { source: string; retrieved_utc: string; start: number; end: number; params: string[]; places: Record<string, { url: string; parameter: Record<string, Record<string, number>> }> }
let snap: Promise<Snapshot> | null = null;
export const loadPowerSnapshot = (): Promise<Snapshot> => (snap ??= fetch("/data/power-snapshot.json").then((r) => r.json() as Promise<Snapshot>));

export interface PowerSeries {
  variable: string; place: { name: string; lat: number; lon: number }; status: DataStatus; retrieved: string; url: string;
  monthly: Record<string, number>; annual: SeriesPoint[]; from: number; to: number; note?: string;
}

const powerUrl = (lat: number, lon: number, v: string, from: number, to: number) =>
  `https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=${v}&community=AG&longitude=${lon}&latitude=${lat}&start=${from}&end=${to}&format=JSON`;

/** Live NASA POWER first (keyless), snapshot fallback for gazetteer places. Never synthesises values. */
export async function getPowerSeries(opts: { lat: number; lon: number; name: string; placeId?: string; variable: string; from: number; to: number; preferLive: boolean }): Promise<PowerSeries> {
  const { lat, lon, name, placeId, variable, from, to } = opts;
  let liveErr = '';
  if (opts.preferLive) {
    const url = powerUrl(lat, lon, variable, from, to);
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 12000);
      const r = await fetch(url, { signal: ctl.signal });
      clearTimeout(timer);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      const monthly = j.properties.parameter[variable] as Record<string, number>;
      return { variable, place: { name, lat, lon }, status: 'live', retrieved: new Date().toISOString(), url, monthly, annual: annualFromPowerMonthly(monthly, from, to), from, to };
    } catch (e: any) { liveErr = e?.name === 'AbortError' ? 'timeout' : String(e?.message || e); }
  }
  const s = await loadPowerSnapshot();
  const pid = placeId ?? PLACES.find((p) => Math.abs(p.lat - lat) < 0.01 && Math.abs(p.lon - lon) < 0.01)?.id;
  const rec = pid ? s.places[pid] : undefined;
  if (!rec) throw new Error(`No live NASA POWER response${liveErr ? ` (${liveErr})` : ''} and no offline snapshot for this location. ORBIT will not invent values.`);
  const f = Math.max(from, s.start), t = Math.min(to, s.end);
  const monthly = rec.parameter[variable];
  return { variable, place: { name, lat, lon }, status: 'snapshot', retrieved: s.retrieved_utc, url: rec.url, monthly, annual: annualFromPowerMonthly(monthly, f, t), from: f, to: t, note: liveErr ? `Live fetch failed (${liveErr}); using bundled snapshot.` : 'Using bundled snapshot.' };
}

/** Snapshot-only quick trend (used for Command Center callouts, no network). */
export async function snapshotTrend(placeId: string, variable: string, from = 2001, to = 2025) {
  const s = await loadPowerSnapshot();
  const rec = s.places[placeId];
  const annual = annualFromPowerMonthly(rec.parameter[variable], from, to);
  return { annual, trend: trend(annual, 5), retrieved: s.retrieved_utc, url: rec.url };
}

/** Mean of the API's annual ("YYYY13") values for one variable at a snapshot place. */
export async function snapshotClimate(placeId: string) {
  const s = await loadPowerSnapshot();
  const par = s.places[placeId].parameter;
  const avg = (k: string) => { const v = Object.entries(par[k]).filter(([d, x]) => d.endsWith('13') && x > -900).map(([, x]) => x); return v.reduce((a, b) => a + b, 0) / v.length; };
  return { tempC: avg('T2M'), precipMmDay: avg('PRECTOTCORR'), solarMJ: avg('ALLSKY_SFC_SW_DWN'), retrieved: s.retrieved_utc };
}
