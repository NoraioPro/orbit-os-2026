// Pattern 2: ANOMALY / INTENT DETECTION
import { mean, poissonTail, std } from './stats';
import type { SeriesPoint } from './types';

export interface CellFlag {
  key: string;
  type: string;
  lat: number; // cell centre
  lon: number;
  current: number;
  previous: number;
  ratio: number;
  p: number;
  score: number;
}

const DAY = 86400000;

/**
 * PRD DG-04 rule: last `days` vs previous `days`, per type and per `cellDeg` cell.
 * Flag when count at least doubles AND rises by at least `minRise` events.
 * A statistical alert, never a forecast.
 */
export function cellFlags<T extends { type: string; lat: number; lon: number; t: number }>(
  events: T[], refTime: number, opts: { days?: number; cellDeg?: number; minRise?: number } = {},
): CellFlag[] {
  const days = opts.days ?? 7, cell = opts.cellDeg ?? 2, minRise = opts.minRise ?? 5;
  const cur = new Map<string, number>(), prev = new Map<string, number>();
  const w = days * DAY;
  for (const e of events) {
    const age = refTime - e.t;
    if (age < 0 || age > 2 * w) continue;
    const k = `${e.type}|${Math.floor(e.lat / cell) * cell}|${Math.floor(e.lon / cell) * cell}`;
    const m = age <= w ? cur : prev;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  const flags: CellFlag[] = [];
  for (const [k, c] of cur) {
    const p = prev.get(k) ?? 0;
    if (c >= 2 * p && c - p >= minRise) {
      const [type, la, lo] = k.split('|');
      const pv = poissonTail(c, Math.max(p, 0.5));
      flags.push({ key: k, type, lat: +la + cell / 2, lon: +lo + cell / 2, current: c, previous: p, ratio: p ? c / p : Infinity, p: pv, score: (c - p) * (1 - Math.min(pv, 0.99)) });
    }
  }
  return flags.sort((a, b) => b.score - a.score);
}

export function zScoreOutliers(pts: SeriesPoint[], threshold = 2) {
  const ys = pts.map((p) => p.y).filter((v): v is number => v !== null);
  const m = mean(ys), s = std(ys);
  return pts.filter((p) => p.y !== null && s > 0 && Math.abs((p.y - m) / s) >= threshold).map((p) => ({ ...p, z: ((p.y as number) - m) / s }));
}

export function confidenceFromP(p: number): { level: 'low' | 'medium' | 'high'; score: number } {
  if (p < 0.01) return { level: 'high', score: 0.9 };
  if (p < 0.05) return { level: 'medium', score: 0.65 };
  return { level: 'low', score: 0.35 };
}
