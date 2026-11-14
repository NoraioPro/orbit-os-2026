// Pattern 7: PREDICT — statistical early warning
// Forecasts the next `horizon` steps of a series from its own history (trend + seasonality),
// and flags when the latest reading diverges from the model's expected envelope.
// Statistical only: this never produces an official warning or emergency alert.
import { mean, std } from './stats';
import { theilSen } from './change';
import type { SeriesPoint } from './types';

export type DivergenceLevel = 'normal' | 'watch' | 'elevated';

export interface ForecastPoint { x: number; y: number; lo: number; hi: number }

export interface Forecast {
  ok: boolean;
  error?: string;
  method: string;
  seasonal: boolean;
  period: number;
  slopePerStep: number;   // robust trend slope, per index step
  residualSd: number;     // in-sample residual std (de-seasonalised)
  rmse: number;
  n: number;
  horizon: number;
  fit: SeriesPoint[];
  forecast: ForecastPoint[];
  expectedNext: number;
  divergence: { z: number; level: DivergenceLevel; text: string };
  limitations: string[];
}

export interface PoissonForecast {
  ok: boolean;
  error?: string;
  lambda: number;
  n: number;
  forecast: { x: number; expected: number; lo: number; hi: number }[];
  latest: number;
  upper: number;
  alert: boolean;
  text: string;
  limitations: string[];
}

const clean = (pts: SeriesPoint[]) => pts.filter((p): p is { x: number; y: number } => p.y !== null && Number.isFinite(p.y));

const LIMITATIONS = [
  'Statistical extrapolation of the historical pattern — not a physical or process model.',
  'Uncertainty widens with horizon; the band is a 95% interval assuming the past pattern persists.',
  'Not an official warning or emergency alert. Human review is required before any decision.',
];

/** Seasonal-trend decomposition + Theil-Sen trend, projected `horizon` steps ahead with a widening 95% prediction band. */
export function forecastSeries(points: SeriesPoint[], opts: { horizon?: number; period?: number } = {}): Forecast {
  const horizon = Math.max(1, Math.round(opts.horizon ?? 12));
  const period = Math.max(1, Math.round(opts.period ?? 12));
  const c = clean(points);
  const empty = (error: string): Forecast => ({ ok: false, error, method: '', seasonal: period > 1, period, slopePerStep: 0, residualSd: 0, rmse: 0, n: c.length, horizon, fit: [], forecast: [], expectedNext: NaN, divergence: { z: 0, level: 'normal', text: '' }, limitations: LIMITATIONS });
  const need = Math.max(4, period);
  if (c.length < need) return empty(`Forecast needs at least ${need} observations (have ${c.length}).`);
  const n = c.length;
  const idx = c.map((_, i) => i);

  // additive seasonal profile per position mod period
  const seasonal = new Array(period).fill(0), cnt = new Array(period).fill(0);
  c.forEach((p, i) => { const s = i % period; seasonal[s] += p.y; cnt[s] += 1; });
  for (let s = 0; s < period; s++) seasonal[s] = cnt[s] ? seasonal[s] / cnt[s] : 0;
  const sm = mean(seasonal);
  const comp = seasonal.map((v) => v - sm);

  // de-seasonalise + robust trend
  const ds = c.map((p, i) => p.y - comp[i % period]);
  const slope = theilSen(ds.map((y, i) => ({ x: i, y })));
  const intercept = mean(ds) - slope * mean(idx);

  const fitVals = idx.map((i) => intercept + slope * i + comp[i % period]);
  const resid = c.map((p, i) => p.y - fitVals[i]);
  const residualSd = std(resid) || 1e-6;
  const rmse = Math.sqrt(mean(resid.map((r) => r * r)));

  const dx = n > 1 ? (c[n - 1].x - c[0].x) / (n - 1) : 1;
  const lastX = c[n - 1].x;
  const forecast: ForecastPoint[] = [];
  for (let h = 1; h <= horizon; h++) {
    const i = n - 1 + h;
    const y = intercept + slope * i + comp[i % period];
    const half = 1.96 * residualSd * Math.sqrt(1 + h / n);
    forecast.push({ x: lastX + h * dx, y, lo: y - half, hi: y + half });
  }

  const z = resid[n - 1] / residualSd;
  const level: DivergenceLevel = Math.abs(z) >= 2.58 ? 'elevated' : Math.abs(z) >= 1.96 ? 'watch' : 'normal';
  const text = level === 'normal'
    ? `Latest observation sits within the expected envelope (z=${z.toFixed(1)}).`
    : `Latest observation is ${z >= 0 ? 'above' : 'below'} the expected envelope (z=${z.toFixed(1)}) — flag for human review.`;

  return {
    ok: true,
    method: period > 1
      ? `Seasonal-trend decomposition (period ${period}) + Theil-Sen trend; 95% prediction band widens with horizon.`
      : `Linear (Theil-Sen) trend on the de-seasonalised series; 95% prediction band widens with horizon.`,
    seasonal: period > 1, period, slopePerStep: slope, residualSd, rmse, n, horizon,
    fit: c.map((p, i) => ({ x: p.x, y: fitVals[i] })),
    forecast, expectedNext: forecast[0]?.y ?? NaN,
    divergence: { z, level, text }, limitations: LIMITATIONS,
  };
}

/** Discrete event-count forecast: trailing-window Poisson rate with a normal-approximation 95% interval. */
export function poissonForecast(counts: number[], opts: { horizon?: number; window?: number } = {}): PoissonForecast {
  const horizon = Math.max(1, Math.round(opts.horizon ?? 7));
  const win = Math.max(4, Math.round(opts.window ?? Math.min(counts.length, 14)));
  const recent = counts.slice(-win).filter((v) => Number.isFinite(v));
  const lims = [...LIMITATIONS, 'Event counts are modelled as a Poisson rate; real hazard depends on many unobserved drivers.'];
  if (!recent.length) return { ok: false, error: 'No finite counts to estimate a rate.', lambda: 0, n: counts.length, forecast: [], latest: NaN, upper: 0, alert: false, text: '', limitations: lims };
  const lambda = mean(recent);
  const sd = Math.sqrt(lambda);
  const upper = lambda + 1.96 * sd;
  const lower = Math.max(0, lambda - 1.96 * sd);
  const n = counts.length;
  const forecast = Array.from({ length: horizon }, (_, h) => ({ x: n + h, expected: lambda, lo: lower, hi: upper }));
  const latest = counts[n - 1];
  const alert = Number.isFinite(latest) && latest > upper;
  const text = alert
    ? `Latest count ${latest} exceeds the 95% Poisson bound (${upper.toFixed(1)}) for the trailing ${win}-period rate λ≈${lambda.toFixed(2)}.`
    : `Latest count ${latest} is within the expected range (λ≈${lambda.toFixed(2)}, 95% upper ${upper.toFixed(1)}).`;
  return { ok: true, lambda, n, forecast, latest, upper, alert, text, limitations: lims };
}
