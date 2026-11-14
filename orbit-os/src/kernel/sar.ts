// SAR EARTH OBSERVATORY — synthetic-aperture-radar change & InSAR kernel.
// Deterministic science over analysis-ready rasters. Honest by construction: it never
// claims full 3-D motion from a single line-of-sight measurement, never equates a visual
// pattern with a physical cause, and labels every simulated raster as SAMPLE.
import { mean, std, haversineKm } from './stats';

export type SarBand = 'L' | 'C' | 'X' | 'S';
export type SarPolarization = 'VV' | 'VH' | 'HH' | 'HV';
export type SarMission = 'NISAR' | 'Sentinel-1' | 'ALOS-2' | 'UAVSAR' | 'OPERA';

export interface SarSceneMeta {
  id: string;
  mission: SarMission;
  instrument: string;
  band: SarBand;
  polarization: SarPolarization;
  level: string;
  start: string;
  end: string;
  footprint: [number, number, number, number];
  orbit: 'ascending' | 'descending';
  relativeOrbit: string;
  provider: string;
  downloadUrl: string | null;
  accessNote: string;
}

export interface SarRaster {
  width: number;
  height: number;
  extent: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  values: number[];                          // row-major
  quantity: 'sigma0-db' | 'phase-rad' | 'coherence' | 'los-displacement-m';
  unit: string;
  label: string;
}

export const SAR_MISSIONS: { id: SarMission; band: SarBand; name: string; note: string }[] = [
  { id: 'NISAR', band: 'L', name: 'NASA–ISRO NISAR (L/S-band)', note: 'L-band (24 cm) + S-band; 12-day repeat; analysis-ready RTC and InSAR products.' },
  { id: 'Sentinel-1', band: 'C', name: 'Copernicus Sentinel-1 (C-band)', note: 'C-band (5.5 cm); 6/12-day repeat; GRD + SLC.' },
  { id: 'ALOS-2', band: 'L', name: 'JAXA ALOS-2 PALSAR-2 (L-band)', note: 'L-band; used for historical (pre-NISAR) comparisons.' },
  { id: 'UAVSAR', band: 'L', name: 'NASA UAVSAR (airborne L-band)', note: 'Airborne L-band for targeted studies.' },
  { id: 'OPERA', band: 'L', name: 'OPERA derived products', note: 'RTC/CSLC/DISP analysis-ready products (NASA).' },
];

const rng = (seed: number) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

function clusterCount(mask: number[], w: number, h: number): number {
  const seen = new Uint8Array(mask.length);
  let clusters = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || seen[i]) continue;
    clusters++;
    const stack = [i];
    seen[i] = 1;
    while (stack.length) {
      const c = stack.pop()!;
      const x = c % w, y = (c / w) | 0;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as [number, number][]) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx;
        if (mask[ni] && !seen[ni]) { seen[ni] = 1; stack.push(ni); }
      }
    }
  }
  return clusters;
}

export interface ChangeResult {
  diff: SarRaster;
  changedCells: number;
  changedPct: number;
  areaKm2: number;
  clusters: number;
  thresholdDb: number;
  method: string;
}

/** σ0 difference (after − before) with a dB threshold, cluster count and area estimate. */
export function backscatterChange(before: SarRaster, after: SarRaster, opts: { thresholdDb?: number } = {}): ChangeResult {
  const thr = opts.thresholdDb ?? 3;
  const w = before.width, h = before.height, n = w * h;
  const diff = new Array<number>(n);
  const mask = new Array<number>(n);
  let changed = 0;
  for (let i = 0; i < n; i++) {
    const d = after.values[i] - before.values[i];
    diff[i] = d;
    if (Math.abs(d) >= thr) { mask[i] = 1; changed++; } else mask[i] = 0;
  }
  const latMid = (before.extent[1] + before.extent[3]) / 2;
  const cellW = ((before.extent[2] - before.extent[0]) / w) * 111.32 * Math.cos((latMid * Math.PI) / 180);
  const cellH = ((before.extent[3] - before.extent[1]) / h) * 110.57;
  return {
    diff: { ...before, values: diff, quantity: 'sigma0-db', unit: 'dB', label: 'Backscatter change (dB)' },
    changedCells: changed,
    changedPct: changed / n,
    areaKm2: changed * cellW * cellH,
    clusters: clusterCount(mask, w, h),
    thresholdDb: thr,
    method: `σ0 difference (after − before), |Δ| ≥ ${thr} dB flagged; area from approximate degree→km cell scale at ${latMid.toFixed(1)}° lat.`,
  };
}

/** Line-of-sight displacement from unwrapped interferometric phase (rad). */
export function phaseToDisplacement(phase: SarRaster, wavelengthM: number): SarRaster {
  const values = phase.values.map((p) => (-p / (4 * Math.PI)) * wavelengthM);
  return { ...phase, values, quantity: 'los-displacement-m', unit: 'm', label: `LOS displacement (λ=${wavelengthM.toFixed(2)} m)` };
}

export function coherenceAnalysis(coh: SarRaster, threshold = 0.3): { lowPct: number; zones: number; threshold: number; note: string } {
  const w = coh.width, h = coh.height;
  const mask = new Array<number>(coh.values.length);
  let low = 0;
  for (let i = 0; i < coh.values.length; i++) { if (coh.values[i] < threshold) { mask[i] = 1; low++; } else mask[i] = 0; }
  return { lowPct: low / coh.values.length, zones: clusterCount(mask, w, h), threshold, note: 'Low coherence can mean real surface change OR decorrelation from vegetation, wet soil or geometry. Not proof of a specific cause.' };
}

export function classifyChange(diff: SarRaster): { label: string; reasoning: string }[] {
  const finite = diff.values.filter((v) => Number.isFinite(v));
  const total = finite.length;
  const neg = finite.filter((v) => v < -3).length / total;
  const pos = finite.filter((v) => v > 3).length / total;
  const out: { label: string; reasoning: string }[] = [];
  if (neg > 0.03) out.push({ label: 'Backscatter decrease', reasoning: 'Return dropped — could be smoother water (flooding), a cleared surface, or loss of vegetation. Polarization and geometry decide which.' });
  if (pos > 0.03) out.push({ label: 'Backscatter increase', reasoning: 'Return rose — could be new structures, rougher ground, or crop growth.' });
  if (!out.length) out.push({ label: 'No significant change', reasoning: 'Few cells exceed the ±3 dB threshold at this geometry.' });
  return out;
}

export interface RelatedEvent { type: string; title: string; distKm: number; time: number }

/** Cross-link a SAR study area to independent events (earthquakes, fires, floods) nearby. */
export function relateEvents(lat: number, lon: number, radiusKm: number, events: { type: string; title: string; lat: number; lon: number; t: number }[]): RelatedEvent[] {
  return events
    .map((e) => ({ ...e, distKm: haversineKm(lat, lon, e.lat, e.lon) }))
    .filter((e) => e.distKm <= radiusKm)
    .sort((a, b) => a.distKm - b.distKm)
    .map(({ type, title, distKm, t }) => ({ type, title, distKm, time: t }));
}

export interface SarPair { before: SarRaster; after: SarRaster; label: string; groundTruth: string }

/** Seeded synthetic before/after pair with an injected, known change region (SAMPLE). */
export function simulateSarPair(scenario: string, opts: { seed?: number; size?: number; extent?: [number, number, number, number] } = {}): SarPair {
  const seed = opts.seed ?? 1, size = opts.size ?? 64;
  const extent = opts.extent ?? ([10.0, 59.0, 11.0, 60.0] as [number, number, number, number]);
  const r = rng(seed);
  const n = size * size;
  const cx = size / 2, cy = size / 2, radius = size / 5;
  const base = new Array<number>(n), changed = new Array<number>(n);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x;
    const inside = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) < radius;
    const b = -18 + (r() - 0.5) * 6;
    let a = b;
    if (inside) {
      if (scenario === 'flood') a = b - 8;
      else if (scenario === 'urban') a = b + 8;
      else if (scenario === 'deforestation') a = b - 6;
      else if (scenario === 'glacier') a = b - 5;
      a += (r() - 0.5) * 2;
    }
    base[i] = b; changed[i] = a;
  }
  const before: SarRaster = { width: size, height: size, extent, values: base, quantity: 'sigma0-db', unit: 'dB', label: 'Before' };
  const after: SarRaster = { width: size, height: size, extent, values: changed, quantity: 'sigma0-db', unit: 'dB', label: 'After' };
  const labels: Record<string, string> = { flood: 'Water / inundation (backscatter drop)', urban: 'New structure (backscatter rise)', deforestation: 'Forest clearing (backscatter drop)', glacier: 'Ice retreat (backscatter drop)' };
  return { before, after, label: labels[scenario] ?? scenario, groundTruth: `Synthetic "${scenario}" scenario — a known change region is injected for testing the detector (SAMPLE).` };
}
