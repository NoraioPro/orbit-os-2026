// GNSS GUARDIAN — navigation-integrity kernel.
// Parses raw satellite-navigation measurements, runs a deterministic signal-integrity
// assessment (anomaly + fusion patterns applied to GNSS), and simulates labelled scenarios
// for reproducible evaluation. Rule-based and explicitly experimental: no output proves
// spoofing or jamming, and nothing here is a certified navigation-safety metric.
import { mean, std, haversineKm } from './stats';
import type { SeriesPoint } from './types';

export type GnssConstellation = 'GPS' | 'GLONASS' | 'Galileo' | 'BeiDou' | 'QZSS' | 'SBAS' | 'Unknown';

export interface GnssMeasurement {
  t: number;                 // epoch ms
  svid: string;              // satellite id, e.g. "G12"
  constellation: GnssConstellation;
  cn0: number;               // dB-Hz
  carrier?: number;          // MHz
  agc?: number;              // dB (automatic gain control)
  lat?: number; lon?: number;
  hAcc?: number;             // horizontal accuracy, m
  state?: string;
}

export type GnssClassification = 'normal' | 'reduced' | 'potential interference' | 'suspicious inconsistency' | 'insufficient evidence';

export interface GnssEvent { t: number; kind: string; severity: 'info' | 'watch' | 'alert'; text: string }

export interface GnssIntegrity {
  ok: boolean; error?: string;
  source: string;
  n: number;
  durationS: number;
  constellations: { id: GnssConstellation; count: number; meanCn0: number; sdCn0: number }[];
  bins: { t: number; cn0: number | null; sats: number; agc: number | null }[];
  baselineCn0: number | null;
  events: GnssEvent[];
  classification: GnssClassification;
  score: number;             // 0..100, higher = more trustworthy
  factors: { label: string; value: string; weight: number; note: string }[];
  limitations: string[];
}

export interface GnssScenario {
  id: string; name: string; description: string;
  anomalous: boolean;         // attack-like (interference / inconsistency) vs mere degradation
  groundTruth: GnssClassification;
  measurements: GnssMeasurement[];
}

export interface GnssEvaluation {
  scenarios: { id: string; name: string; groundTruth: GnssClassification; classification: GnssClassification; detected: boolean; correct: boolean }[];
  tp: number; fp: number; fn: number; tn: number;
  precision: number; recall: number; f1: number;
  note: string;
}

const LIMITATIONS = [
  'Rule-based heuristic — an experimental integrity indicator, not a certified navigation-safety metric.',
  'Phone-grade receivers have hardware limits (multipath, oscillator drift) that are hard to separate from weak interference.',
  'No detector output proves spoofing or jamming; it only flags conditions worth expert review.',
  'Real-world detection accuracy has not been established against live attack data.',
];

const median = (a: number[]) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const rng = (seed: number) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

const CONST_NUM: Record<number, GnssConstellation> = { 1: 'GPS', 3: 'GLONASS', 5: 'BeiDou', 6: 'Galileo', 7: 'QZSS', 2: 'SBAS', 4: 'QZSS' };
export function constellationFrom(raw: string | number): GnssConstellation {
  if (typeof raw === 'number') return CONST_NUM[raw] ?? 'Unknown';
  const c = String(raw).trim().toUpperCase();
  if (/^\d+$/.test(c)) return CONST_NUM[parseInt(c, 10)] ?? 'Unknown';
  if (c.startsWith('G')) return 'GPS';
  if (c.startsWith('R')) return 'GLONASS';
  if (c.startsWith('E')) return 'Galileo';
  if (c.startsWith('C')) return 'BeiDou';
  if (c.startsWith('J')) return 'QZSS';
  return 'Unknown';
}

/* ---------------- Ingestion ---------------- */

export function parseGnssLogger(text: string, source = 'GnssLogger upload'): { ok: boolean; error?: string; measurements: GnssMeasurement[]; skipped: number; notes: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#'));
  if (lines.length < 2) return { ok: false, error: 'File has no data rows.', measurements: [], skipped: 0, notes: [] };
  let headerIdx = -1;
  for (let i = 0; i < Math.min(lines.length, 40); i++) if (/svid|cn0|constellation|elapsedrealtime|signal/i.test(lines[i])) { headerIdx = i; break; }
  if (headerIdx < 0) return { ok: false, error: 'No GnssLogger header row found (expected Svid / Cn0DbHz / ConstellationType columns).', measurements: [], skipped: 0, notes: [] };
  const header = lines[headerIdx].split(',').map((h) => h.trim().toLowerCase());
  const col = (names: string[]) => { for (const n of names) { const i = header.findIndex((h) => h.includes(n)); if (i >= 0) return i; } return -1; };
  const cMillis = col(['elapsedrealtimemillis', 'utctimemillis', 'millis', 'time']);
  const cSvid = col(['svid']);
  const cConst = col(['constellationtype', 'constellation']);
  const cCn0 = col(['cn0dbhz', 'cn0db', 'cn0']);
  const cAgc = col(['agcdb', 'agc']);
  const cCarrier = col(['carrierfrequencyhz', 'carrierfrequency', 'carrier']);
  const cLat = col(['latitudedegrees', 'latitude', 'lat']);
  const cLon = col(['longitudedegrees', 'longitude', 'lon', 'lng']);
  const cHAcc = col(['horizontalaccuracymeters', 'hacc', 'accuracy']);
  const cState = col(['state']);
  if (cSvid < 0 || cCn0 < 0) return { ok: false, error: `Header found but missing required columns (Svid=${cSvid >= 0 ? 'ok' : 'missing'}, Cn0=${cCn0 >= 0 ? 'ok' : 'missing'}).`, measurements: [], skipped: 0, notes: [] };
  const measurements: GnssMeasurement[] = [];
  let skipped = 0;
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    const svidRaw = (parts[cSvid] ?? '').trim();
    const cn0Raw = (parts[cCn0] ?? '').trim();
    if (!svidRaw || !cn0Raw) { skipped++; continue; }
    const cn0 = parseFloat(cn0Raw);
    if (!Number.isFinite(cn0) || cn0 <= 0) { skipped++; continue; }
    const millis = cMillis >= 0 ? parseFloat(parts[cMillis]) : NaN;
    const lat = cLat >= 0 ? parseFloat(parts[cLat]) : NaN;
    const lon = cLon >= 0 ? parseFloat(parts[cLon]) : NaN;
    const agc = cAgc >= 0 ? parseFloat(parts[cAgc]) : NaN;
    const carrier = cCarrier >= 0 ? parseFloat(parts[cCarrier]) : NaN;
    const hAcc = cHAcc >= 0 ? parseFloat(parts[cHAcc]) : NaN;
    measurements.push({
      t: Number.isFinite(millis) ? millis : i,
      svid: svidRaw, constellation: constellationFrom(cConst >= 0 ? parts[cConst] : svidRaw), cn0,
      agc: Number.isFinite(agc) ? agc : undefined,
      carrier: Number.isFinite(carrier) ? carrier : undefined,
      lat: Number.isFinite(lat) ? lat : undefined, lon: Number.isFinite(lon) ? lon : undefined,
      hAcc: Number.isFinite(hAcc) ? hAcc : undefined,
      state: cState >= 0 ? (parts[cState] ?? '').trim() : undefined,
    });
  }
  if (!measurements.length) return { ok: false, error: 'No valid measurements parsed (all rows skipped).', measurements: [], skipped, notes: [] };
  return { ok: true, measurements, skipped, notes: [] };
}

const nmeaCoord = (v: string, hemi: string) => { const d = parseFloat(v.slice(0, 2)); const mm = parseFloat(v.slice(2)); if (!Number.isFinite(d) || !Number.isFinite(mm)) return NaN; const deg = d + mm / 60; return hemi === 'S' || hemi === 'W' ? -deg : deg; };

export function parseNmea(text: string, source = 'NMEA upload'): { ok: boolean; error?: string; measurements: GnssMeasurement[]; skipped: number } {
  const m: GnssMeasurement[] = [];
  const fixes: { t: number; lat: number; lon: number; hAcc: number }[] = [];
  let t = 0;
  for (const line of text.split(/\r?\n/)) {
    const l = line.trim(); if (!l.startsWith('$')) continue;
    const parts = l.slice(1).split('*')[0].split(',');
    const kind = parts[0];
    if (kind === 'GPGGA' || kind === 'GNGGA') {
      const lat = nmeaCoord(parts[2] ?? '', parts[3] ?? '');
      const lon = nmeaCoord(parts[4] ?? '', parts[5] ?? '');
      if (Number.isFinite(lat) && Number.isFinite(lon)) fixes.push({ t, lat, lon, hAcc: parseFloat(parts[8] ?? '') || NaN }); // HDOP, not metres — labelled below
    } else if (/^(G[PLANB]|G[ANB])GSV$/.test(kind)) {
      const constId = kind.slice(0, 2);
      const constellation = constId === 'GL' ? 'GLONASS' : constId === 'GA' ? 'Galileo' : constId === 'GB' ? 'BeiDou' : 'GPS';
      for (let i = 4; i + 3 < parts.length; i += 4) {
        const svidRaw = parts[i], snrRaw = parts[i + 3];
        if (!svidRaw || !snrRaw) continue;
        const cn0 = parseFloat(snrRaw);
        if (!Number.isFinite(cn0)) continue;
        m.push({ t, svid: `${constId}${svidRaw}`, constellation: constellation as GnssConstellation, cn0 });
      }
      t += 1000;
    }
  }
  if (fixes.length) { const fm = new Map(fixes.map((f) => [f.t, f])); for (const r of m) { const f = fm.get(r.t); if (f) { r.lat = f.lat; r.lon = f.lon; r.hAcc = f.hAcc; } } }
  if (!m.length) return { ok: false, error: 'No GSV/GGA sentences parsed.', measurements: [], skipped: 0 };
  return { ok: true, measurements: m, skipped: 0 };
}

/* ---------------- Integrity engine ---------------- */

export function gnssIntegrity(raw: GnssMeasurement[], opts: { source?: string; minMeasurements?: number } = {}): GnssIntegrity {
  const source = opts.source ?? 'GNSS recording';
  const minM = opts.minMeasurements ?? 20;
  const m = [...raw].sort((a, b) => a.t - b.t);
  const empty = (error: string): GnssIntegrity => ({ ok: false, error, source, n: m.length, durationS: 0, constellations: [], bins: [], baselineCn0: null, events: [], classification: 'insufficient evidence', score: 0, factors: [], limitations: LIMITATIONS });
  if (m.length < minM) return empty(`Insufficient evidence: ${m.length} measurements (need ≥${minM}).`);
  const t0 = m[0].t, t1 = m[m.length - 1].t;
  const durationS = (t1 - t0) / 1000;
  if (durationS < 1) return empty('Recording is shorter than 1 second — not enough to assess.');

  const byConst = new Map<GnssConstellation, number[]>();
  for (const r of m) { const a = byConst.get(r.constellation) ?? []; a.push(r.cn0); byConst.set(r.constellation, a); }
  const constellations = [...byConst.entries()].map(([id, arr]) => ({ id, count: arr.length, meanCn0: mean(arr), sdCn0: std(arr) })).sort((a, b) => b.count - a.count);

  const binS = Math.max(1, Math.ceil(durationS / 120));
  const nb = Math.max(2, Math.ceil(durationS / binS));
  const bins: GnssIntegrity['bins'] = [];
  for (let b = 0; b < nb; b++) {
    const lo = t0 + b * binS * 1000, hi = t0 + (b + 1) * binS * 1000;
    const inB = m.filter((r) => r.t >= lo && r.t < hi);
    const cn0s = inB.map((r) => r.cn0);
    const agcs = inB.map((r) => r.agc).filter((v): v is number => v !== undefined);
    bins.push({ t: (lo - t0) / 1000, cn0: cn0s.length ? mean(cn0s) : null, sats: new Set(inB.map((r) => r.svid)).size, agc: agcs.length ? mean(agcs) : null });
  }
  const early = bins.slice(0, Math.max(1, Math.floor(nb * 0.25)));
  const baselineCn0 = median(early.map((b) => b.cn0).filter((v): v is number => v !== null));
  const earlyAgc = early.map((b) => b.agc).filter((v): v is number => v !== null);
  const baselineAgc = earlyAgc.length ? median(earlyAgc) : null;
  const baselineSats = median(early.map((b) => b.sats).filter((v) => v > 0));

  const events: GnssEvent[] = [];
  const add = (t: number, kind: string, severity: GnssEvent['severity'], text: string) => events.push({ t, kind, severity, text });

  let run = 0;
  for (const b of bins) {
    if (b.cn0 !== null && Number.isFinite(baselineCn0) && b.cn0 < baselineCn0 - 6) { run++; if (run === 2) add(b.t, 'C/N0 drop', 'watch', `Sustained C/N0 ${Math.round(b.cn0)} dB-Hz vs early baseline ${baselineCn0.toFixed(0)} dB-Hz.`); }
    else run = 0;
  }
  if (baselineAgc !== null) for (const b of bins) if (b.agc !== null && b.agc > baselineAgc + 8) add(b.t, 'AGC rise', 'watch', `AGC ${Math.round(b.agc)} dB vs early baseline ${baselineAgc.toFixed(1)} dB — possible nearby transmitter.`);
  if (Number.isFinite(baselineSats)) for (const b of bins) if (b.sats > 0 && b.sats < baselineSats - 4) add(b.t, 'Satellite loss', 'watch', `Visible satellites ${b.sats} vs early baseline ${Math.round(baselineSats)}.`);

  const fixes = m.filter((r) => r.lat !== undefined && r.lon !== undefined).sort((a, b) => a.t - b.t);
  for (let i = 1; i < fixes.length; i++) {
    const d = haversineKm(fixes[i - 1].lat!, fixes[i - 1].lon!, fixes[i].lat!, fixes[i].lon!) * 1000;
    const dt = (fixes[i].t - fixes[i - 1].t) / 1000;
    if (d > 500 && dt < 60) add((fixes[i].t - t0) / 1000, 'Position jump', 'alert', `Fix moved ${Math.round(d)} m in ${dt.toFixed(0)} s.`);
  }
  if (fixes.length > 2) {
    const span = haversineKm(fixes[0].lat!, fixes[0].lon!, fixes[fixes.length - 1].lat!, fixes[fixes.length - 1].lon!) * 1000;
    const hAccMin = Math.min(...fixes.map((f) => f.hAcc ?? 1e9));
    if (span > 1000 && hAccMin < 50) add((fixes[fixes.length - 1].t - t0) / 1000, 'Inconsistent drift', 'alert', `Position drifted ${Math.round(span)} m while reporting ${Math.round(hAccMin)} m accuracy.`);
  }

  const hasJump = events.some((e) => e.kind === 'Position jump' || e.kind === 'Inconsistent drift');
  const hasDrop = events.some((e) => e.kind === 'C/N0 drop');
  const hasAgc = events.some((e) => e.kind === 'AGC rise');
  let classification: GnssClassification;
  if (hasJump) classification = 'suspicious inconsistency';
  else if (hasDrop && hasAgc) classification = 'potential interference';
  else if (events.length) classification = 'reduced';
  else classification = 'normal';

  const completeness = Math.min(1, bins.filter((b) => b.sats > 0).length / bins.length);
  const quality = Number.isFinite(baselineCn0) ? clamp((baselineCn0 - 15) / 35, 0, 1) : 0;
  const factors = [
    { label: 'Completeness', value: `${Math.round(completeness * 100)}%`, weight: 0.2, note: 'Fraction of time bins with an observed fix.' },
    { label: 'Signal quality', value: Number.isFinite(baselineCn0) ? `${baselineCn0.toFixed(0)} dB-Hz` : '—', weight: 0.3, note: 'Median early C/N0 across all satellites.' },
    { label: 'Temporal consistency', value: Number.isFinite(std(m.map((r) => r.cn0))) ? `σ ${std(m.map((r) => r.cn0)).toFixed(1)} dB-Hz` : '—', weight: 0.2, note: 'Spread of C/N0 over the recording.' },
    { label: 'Independent checks', value: fixes.length > 2 ? 'position fixes present' : 'no position', weight: 0.15, note: 'Position fixes enable jump/drift checks.' },
    { label: 'Hardware support', value: m.some((r) => r.agc !== undefined) ? 'AGC present' : 'no AGC', weight: 0.15, note: 'AGC enables interference discrimination.' },
  ];
  const consistencyScore = Number.isFinite(std(m.map((r) => r.cn0))) ? clamp(1 - std(m.map((r) => r.cn0)) / 12, 0, 1) : 0.5;
  const independent = fixes.length > 2 ? 1 : 0.3;
  const hardware = m.some((r) => r.agc !== undefined) ? 1 : 0.5;
  const rawScore = 100 * (completeness * 0.2 + quality * 0.3 + consistencyScore * 0.2 + independent * 0.15 + hardware * 0.15);
  const penalty = Math.min(45, events.filter((e) => e.severity === 'alert').length * 15 + events.filter((e) => e.severity === 'watch').length * 5);
  const score = Math.max(0, Math.min(100, Math.round(rawScore - penalty)));

  return { ok: true, source, n: m.length, durationS, constellations, bins, baselineCn0, events, classification, score, factors, limitations: LIMITATIONS };
}

/* ---------------- Scenario simulation (labelled, seeded) ---------------- */

export const GNSS_SCENARIOS = [
  { id: 'open-sky', name: 'Open-sky normal', anomalous: false, groundTruth: 'normal' as GnssClassification, description: 'Clear view, steady C/N0, no events.' },
  { id: 'multipath', name: 'Urban multipath', anomalous: false, groundTruth: 'reduced' as GnssClassification, description: 'Fast C/N0 fading from reflected signals (not an attack).' },
  { id: 'outage', name: 'Temporary outage', anomalous: false, groundTruth: 'reduced' as GnssClassification, description: 'All satellites lost for 60 s (obstruction / receiver reset).' },
  { id: 'tunnel', name: 'Tunnel attenuation', anomalous: false, groundTruth: 'reduced' as GnssClassification, description: 'Gradual attenuation to loss, then recovery.' },
  { id: 'low-signal', name: 'Low-signal interference', anomalous: true, groundTruth: 'potential interference' as GnssClassification, description: 'Broadband noise lowers C/N0 and raises AGC.' },
  { id: 'position-jump', name: 'Position jump', anomalous: true, groundTruth: 'suspicious inconsistency' as GnssClassification, description: 'Fix jumps ~2 km east while reported accuracy stays high.' },
  { id: 'position-drift', name: 'Position drift', anomalous: true, groundTruth: 'suspicious inconsistency' as GnssClassification, description: 'Fix slowly drifts with no reported movement.' },
  { id: 'mixed', name: 'Mixed degradation', anomalous: true, groundTruth: 'suspicious inconsistency' as GnssClassification, description: 'C/N0 drop + AGC rise + position jump.' },
];

const BASE_SATS = ['G1', 'G8', 'G11', 'G17', 'G28', 'R3', 'R9', 'E5', 'E19', 'C12'];
const SAT_CN0: Record<string, number> = { G1: 42, G8: 40, G11: 44, G17: 41, G28: 43, R3: 39, R9: 38, E5: 40, E19: 41, C12: 37 };

export function simulateGnss(scenarioId: string, opts: { seed?: number; seconds?: number; dt?: number } = {}): GnssScenario {
  const seed = opts.seed ?? 1, seconds = opts.seconds ?? 300, dt = opts.dt ?? 5;
  const r = rng(seed);
  const N = Math.floor(seconds / dt);
  const LAT = 59.91, LON = 10.75;
  const measurements: GnssMeasurement[] = [];
  for (let i = 0; i < N; i++) {
    const sec = i * dt;
    for (const svid of BASE_SATS) {
      const base = SAT_CN0[svid] ?? 40;
      let cn0 = base + (r() - 0.5) * 4;
      let agc = 1.5 + (r() - 0.5);
      let lat = LAT, lon = LON;
      switch (scenarioId) {
        case 'multipath': cn0 += 8 * Math.sin(sec / 3) + (r() - 0.5) * 6; break;
        case 'outage': if (sec > 120 && sec < 180) continue; break;
        case 'tunnel': if (sec > 100 && sec < 160) { cn0 -= Math.min(25, (sec - 100) * 0.6); if (cn0 < 12) continue; } break;
        case 'low-signal': if (sec > 150) { cn0 -= 12; agc = 12 + (r() - 0.5); } break;
        case 'position-jump': if (sec > 150) lon = LON + 0.02; break;
        case 'position-drift': lon = LON + 0.00005 * sec; break;
        case 'mixed': if (sec > 120) { cn0 -= 10; agc = 12 + (r() - 0.5); } if (sec > 180) lon = LON + 0.015; break;
      }
      const withPos = (scenarioId === 'position-jump' || scenarioId === 'position-drift' || scenarioId === 'mixed') && i % 3 === 0 && svid === 'G1';
      measurements.push({ t: i * dt * 1000, svid, constellation: constellationFrom(svid), cn0: Math.max(8, cn0), agc, ...(withPos ? { lat, lon, hAcc: 5 } : {}) });
    }
  }
  const meta = GNSS_SCENARIOS.find((s) => s.id === scenarioId) ?? GNSS_SCENARIOS[0];
  return { id: scenarioId, name: meta.name, description: meta.description, anomalous: meta.anomalous, groundTruth: meta.groundTruth, measurements };
}

/* ---------------- Evaluation (simulated only) ---------------- */

export function evaluateDetector(scenarioIds: string[] = GNSS_SCENARIOS.map((s) => s.id), opts: { seed?: number } = {}): GnssEvaluation {
  const rows = scenarioIds.map((id) => {
    const s = simulateGnss(id, opts);
    const g = gnssIntegrity(s.measurements, { source: `sim:${id}` });
    const detected = g.ok && (g.classification === 'potential interference' || g.classification === 'suspicious inconsistency');
    return { id, name: s.name, groundTruth: s.groundTruth, classification: g.classification, detected, correct: s.anomalous ? detected : !detected };
  });
  const tp = rows.filter((r) => r.correct && r.detected).length;
  const tn = rows.filter((r) => r.correct && !r.detected).length;
  const fp = rows.filter((r) => !r.correct && r.detected).length;
  const fn = rows.filter((r) => !r.correct && !r.detected).length;
  const precision = tp + fp ? tp / (tp + fp) : 1;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { scenarios: rows, tp, fp, fn, tn, precision, recall, f1, note: 'Simulated performance only. Real attack data was not available, so real-world detection accuracy is not established.' };
}
