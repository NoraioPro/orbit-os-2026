// Pattern 1: CHANGE OVER TIME
import { mean, normCdf, std } from './stats';
import type { SeriesPoint } from './types';

export interface TrendResult {
  n: number;
  olsSlope: number; // units per x-step (year)
  intercept: number;
  theilSen: number;
  mkZ: number;
  mkP: number; // two-sided
  significant: boolean;
  firstMean: number;
  lastMean: number;
  delta: number;
  deltaPct: number;
}

const clean = (pts: SeriesPoint[]) => pts.filter((p): p is { x: number; y: number } => p.y !== null && Number.isFinite(p.y));

export function ols(pts: SeriesPoint[]) {
  const c = clean(pts);
  const mx = mean(c.map((p) => p.x));
  const my = mean(c.map((p) => p.y));
  let num = 0, den = 0;
  for (const p of c) { num += (p.x - mx) * (p.y - my); den += (p.x - mx) ** 2; }
  const slope = den ? num / den : 0;
  return { slope, intercept: my - slope * mx };
}

export function theilSen(pts: SeriesPoint[]) {
  const c = clean(pts);
  const s: number[] = [];
  for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) if (c[j].x !== c[i].x) s.push((c[j].y - c[i].y) / (c[j].x - c[i].x));
  s.sort((a, b) => a - b);
  if (!s.length) return 0;
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Mann-Kendall trend test (no tie correction; adequate for continuous climate series). */
export function mannKendall(pts: SeriesPoint[]) {
  const y = clean(pts).map((p) => p.y);
  const n = y.length;
  let S = 0;
  for (let i = 0; i < n - 1; i++) for (let j = i + 1; j < n; j++) S += Math.sign(y[j] - y[i]);
  const varS = (n * (n - 1) * (2 * n + 5)) / 18;
  const z = varS > 0 ? (S > 0 ? (S - 1) / Math.sqrt(varS) : S < 0 ? (S + 1) / Math.sqrt(varS) : 0) : 0;
  const p = 2 * (1 - normCdf(Math.abs(z)));
  return { S, z, p };
}

export function trend(pts: SeriesPoint[], windowYears = 5): TrendResult {
  const c = clean(pts);
  const { slope, intercept } = ols(c);
  const mk = mannKendall(c);
  const w = Math.max(1, Math.min(windowYears, Math.floor(c.length / 2)));
  const firstMean = mean(c.slice(0, w).map((p) => p.y));
  const lastMean = mean(c.slice(-w).map((p) => p.y));
  const delta = lastMean - firstMean;
  return {
    n: c.length,
    olsSlope: slope,
    intercept,
    theilSen: theilSen(c),
    mkZ: mk.z,
    mkP: mk.p,
    significant: mk.p < 0.05,
    firstMean,
    lastMean,
    delta,
    deltaPct: firstMean ? (delta / Math.abs(firstMean)) * 100 : NaN,
  };
}

/** Compare the last `recent` points against the preceding baseline. */
export function windowCompare(pts: SeriesPoint[], recent: number) {
  const c = clean(pts);
  const r = c.slice(-recent).map((p) => p.y);
  const b = c.slice(0, -recent).map((p) => p.y);
  const z = std(b) ? (mean(r) - mean(b)) / std(b) : NaN;
  return { recentMean: mean(r), baselineMean: mean(b), delta: mean(r) - mean(b), z, nRecent: r.length, nBaseline: b.length };
}

/** Monthly POWER dict {YYYYMM: v} -> annual means (uses the API's month "13" annual value when present). */
export function annualFromPowerMonthly(dict: Record<string, number>, from: number, to: number): SeriesPoint[] {
  const out: SeriesPoint[] = [];
  for (let y = from; y <= to; y++) {
    const ann = dict[`${y}13`];
    if (ann !== undefined && ann > -900) { out.push({ x: y, y: ann }); continue; }
    const months = Array.from({ length: 12 }, (_, i) => dict[`${y}${String(i + 1).padStart(2, '0')}`]).filter((v) => v !== undefined && v > -900);
    out.push({ x: y, y: months.length === 12 ? mean(months) : null });
  }
  return out;
}

/** Monthly climatology (mean per calendar month) from a POWER monthly dict. */
export function climatology(dict: Record<string, number>, from: number, to: number) {
  return Array.from({ length: 12 }, (_, m) => {
    const vals: number[] = [];
    for (let y = from; y <= to; y++) {
      const v = dict[`${y}${String(m + 1).padStart(2, '0')}`];
      if (v !== undefined && v > -900) vals.push(v);
    }
    return { x: m + 1, y: vals.length ? mean(vals) : null };
  });
}
