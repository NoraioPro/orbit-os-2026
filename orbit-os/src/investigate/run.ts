import { analogScore, confidenceFromP, fmt, fuse, haversineKm, signed, trend, windowCompare, WORLDS, type DataStatus, type EvidencePack, type Indicator } from '../kernel';
import { eventsInCell, isoDay, isoMin, loadEvents, nearestPlaceName, TYPE_META } from '../data/events';
import { trendEvidence } from '../data/evidence';
import { getPowerSeries, loadPowerSnapshot, PLACES, POWER_VARS } from '../data/power';
import { eonetEvents, usgsCount } from '../data/live';
import { GAZ_TO_HARVEST, harvestPowerEvidence, loadFirms, loadPowerHarvest } from '../data/harvest';
import { deterministicPlan, buildSteps, type InvestigationPlan } from './plan';
import { llmNarrate, llmPlan } from './llm';

export interface InvestigationResult { id: string; plan: InvestigationPlan; evidence: EvidencePack; extra: EvidencePack[]; narrative: string; narrator: 'deterministic' | 'llm'; ranAt: string }

const DAY = 86400000;
const worst = (a: DataStatus[]): DataStatus => (a.includes('sample') ? 'sample' : a.includes('snapshot') ? 'snapshot' : 'live');

export async function investigate(question: string, opts: { preferLive: boolean; useLlm: boolean; onStep?: (p: InvestigationPlan) => void }): Promise<InvestigationResult> {
  let plan = deterministicPlan(question);
  if (opts.useLlm) {
    const lp = await llmPlan(question, plan).catch(() => null);
    if (lp) plan = { ...plan, ...lp, planner: 'llm', steps: buildSteps(lp.intent ?? plan.intent) };
  }
  const mark = (i: number, status: 'done' | 'failed' | 'skipped' | 'planned', detail?: string) => {
    plan = { ...plan, steps: plan.steps.map((s, k) => (k === i ? { ...s, status, detail: detail ?? s.detail } : s)) };
    opts.onStep?.(plan);
  };
  mark(0, 'done', plan.place ? `${plan.place.name} (${plan.place.lat.toFixed(2)}, ${plan.place.lon.toFixed(2)}), r=${plan.place.radiusKm} km` : 'Global (no location named)');
  mark(1, 'done', plan.datasets.join(', ') || '—');

  let evidence: EvidencePack;
  const extra: EvidencePack[] = [];

  if (plan.intent === 'trend' && plan.place) {
    const pl = plan.place;
    const series = await Promise.all(plan.variables.map((v) => getPowerSeries({ lat: pl.lat, lon: pl.lon, name: pl.name, placeId: pl.id, variable: v, from: plan.yearFrom, to: plan.yearTo, preferLive: opts.preferLive }).catch((e) => e as Error)));
    const ok = series.filter((s): s is Exclude<typeof s, Error> => !(s instanceof Error));
    if (!ok.length) { mark(2, 'failed', (series[0] as Error).message); throw series[0]; }
    mark(2, 'done', ok.map((s) => `${s.variable}: ${s.status}`).join(' · '));
    const packs = ok.map((s) => {
      const ev = trendEvidence(s, plan.recentYears);
      const wc = windowCompare(s.annual, plan.recentYears);
      ev.metrics.push({ label: `Last ${plan.recentYears} y vs baseline`, value: `${signed(wc.delta, 2)} ${POWER_VARS[s.variable].unit} (z=${fmt(wc.z, 1)})`, status: s.status });
      return { ev, s, wc };
    });
    mark(3, 'done', packs.map((p) => `${p.s.variable} ${signed(trend(p.s.annual).theilSen * 10, 2)}/decade`).join(' · '));
    evidence = packs[0].ev;
    if (packs.length > 1) {
      // Fusion: do the drivers agree that conditions changed in the recent window?
      const ind: Indicator[] = packs.map((p) => ({ name: p.s.variable, signal: Math.max(-1, Math.min(1, (p.wc.z || 0) / 2)), quality: p.s.annual.filter((x) => x.y !== null).length / p.s.annual.length, status: p.s.status }));
      const f = fuse(ind);
      evidence.kind = 'fusion';
      evidence.title = `Growth-driver change · ${pl.name}`;
      evidence.patterns = ['change', 'fusion', 'anomaly', 'review'];
      evidence.metrics.unshift({ label: 'Fused signal (recent vs baseline)', value: `${signed(f.support, 2)} · agreement ${Math.round(f.agreement * 100)}%`, status: worst(packs.map((p) => p.s.status)) });
      evidence.confidence = { level: f.level, score: f.confidence, rationale: `Fusion of ${ind.length} indicators (${ind.map((i) => `${i.name} ${signed(i.signal, 2)}`).join(', ')}). ${evidence.confidence.rationale}` };
      extra.push(...packs.slice(1).map((p) => p.ev));
    }
    const hid = pl.id ? GAZ_TO_HARVEST[pl.id] : undefined;
    if (hid) {
      const h = await loadPowerHarvest().catch(() => null);
      const hv = h ? plan.variables.find((v) => v in h.units) : undefined;
      const hp = h && hv ? harvestPowerEvidence(h, hid, hv) : null;
      if (hp) { extra.unshift(hp); evidence.metrics.push({ label: `${hv} last 12 mo shift (daily harvest)`, value: hp.metrics[2].value, status: 'live' }); }
    }
    mark(4, 'done');
    mark(5, 'done');
  } else if (plan.intent === 'events' || plan.intent === 'anomaly') {
    const db = await loadEvents();
    const tm = plan.eventType ? TYPE_META[plan.eventType] : undefined;
    const since = db.refTime - plan.days * DAY;
    const inAoi = (e: { lat: number; lon: number }) => !plan.place || haversineKm(plan.place.lat, plan.place.lon, e.lat, e.lon) <= plan.place.radiusKm;
    const rows = db.events.filter((e) => (!plan.eventType || e.type === plan.eventType) && e.t >= since && e.t <= db.refTime && inAoi(e));
    const flags = db.flags.filter((f) => (!plan.eventType || f.type === plan.eventType) && inAoi(f));
    const metrics: EvidencePack['metrics'] = [
      { label: `Records (${plan.days} d, ${db.source === 'harvest' ? 'harvest' : 'shards'})`, value: rows.length.toLocaleString('en-US'), status: db.status },
      { label: 'Flagged 2° cells (DG-04)', value: String(flags.length), status: db.status },
    ];
    if (plan.intent === 'events') {
      mark(2, 'done', `${rows.length} records`);
      if (opts.preferLive) {
        try {
          if (plan.eventType === 'earthquake') {
            const end = new Date().toISOString().slice(0, 10), start = new Date(Date.now() - plan.days * DAY).toISOString().slice(0, 10);
            const lc = plan.place ? await usgsCount({ lat: plan.place.lat, lon: plan.place.lon, radiusKm: plan.place.radiusKm, start, end }) : await usgsCount({ lat: 0, lon: 0, radiusKm: 20001, start, end });
            metrics.push({ label: `USGS live count (${start} → today)`, value: lc.count.toLocaleString('en-US'), status: 'live' });
            mark(3, 'done', `USGS live count = ${lc.count}`);
          } else {
            const cat = plan.eventType === 'wildfires' ? 'wildfires' : plan.eventType;
            const bbox: [number, number, number, number] | undefined = plan.place ? [plan.place.lon - 5, plan.place.lat + 5, plan.place.lon + 5, plan.place.lat - 5] : undefined;
            const le = await eonetEvents({ category: cat, days: plan.days, bbox });
            metrics.push({ label: `EONET live open events (${plan.days} d)`, value: String(le.events.length), status: 'live' });
            mark(3, 'done', `EONET live open events = ${le.events.length}`);
          }
        } catch (e: any) { mark(3, 'failed', `Live check failed (${e?.message ?? e}); snapshot only`); }
      } else mark(3, 'skipped', 'Live mode off (Settings)');
      mark(4, 'done', `${flags.length} flags`);
    } else { mark(2, 'done', `${flags.length} flags`); mark(3, 'done'); }
    if (plan.eventType === 'wildfires') {
      const g = await loadFirms().catch(() => null);
      if (g) { const n = g.cells.filter((c) => inAoi({ lat: c[0], lon: c[1] })).reduce((a, c) => a + c[2], 0); metrics.push({ label: 'FIRMS detections, last 24 h', value: n.toLocaleString('en-US'), status: 'live' }); }
    }
    const top = flags.slice(0, 8);
    const days = Array.from({ length: plan.days }, (_, i) => { const end = db.refTime - (plan.days - 1 - i) * DAY; return { x: i - plan.days + 1, y: rows.filter((e) => e.t <= end && e.t > end - DAY).length }; });
    const bestP = top.length ? Math.min(...top.map((f) => f.p)) : 1;
    const c = plan.intent === 'anomaly' ? confidenceFromP(bestP) : { level: 'high' as const, score: 0.85 };
    evidence = {
      id: `inv:${Date.now()}`,
      title: `${tm?.label ?? 'Natural events'}${plan.intent === 'anomaly' ? ' anomalies' : ''} · ${plan.place?.name ?? 'Global'}`,
      subtitle: `${plan.days}-day window ending ${db.source === 'harvest' ? 'at harvest time' : 'at snapshot time'}`,
      kind: plan.intent === 'anomaly' ? 'anomaly' : 'investigation',
      status: db.status,
      statusLabel: db.label,
      sources: [{ name: db.source === 'harvest' ? 'ORBIT data-collector harvest (USGS + NASA EONET)' : 'ORBIT shards (USGS ComCat + NASA EONET)', retrieved: db.meta.snapshot_utc }, ...(plan.eventType === 'wildfires' ? [{ name: 'NASA FIRMS 24 h NRT (harvest, 1° cells)', url: 'https://firms.modaps.eosdis.nasa.gov/active_fire/' }] : []), ...(plan.eventType === 'earthquake' ? [{ name: 'USGS FDSN event count API', url: 'https://earthquake.usgs.gov/fdsnws/event/1/' }] : [{ name: 'NASA EONET v3', url: 'https://eonet.gsfc.nasa.gov/api/v3/events' }])],
      window: { start: isoDay(since), end: isoDay(db.refTime), label: `${plan.days} days` },
      location: plan.place ? { name: plan.place.name, lat: plan.place.lat, lon: plan.place.lon, radiusKm: plan.place.radiusKm } : undefined,
      confidence: { ...c, rationale: plan.intent === 'anomaly' ? (top.length ? `Strongest flag Poisson p=${bestP.toExponential(1)}.` : 'No cell met the DG-04 rule.') : 'Counts of catalogued records; agency catalogues are authoritative but revisable.' },
      method: plan.intent === 'anomaly' ? 'DG-04 fixed-window rule per 2° cell (≥2× and ≥+5 vs previous 7 days) + Poisson tail ranking.' : 'Radius + time filter over the snapshot, plus a live count from the source API where possible.',
      metrics: [...metrics, ...top.slice(0, 4).map((f) => ({ label: `Flag · ${nearestPlaceName(db, f.lat, f.lon, f.type)}`, value: `${f.previous} → ${f.current}`, status: db.status }))],
      series: { label: 'Daily records', unit: 'records/day', points: days },
      records: (top.length ? top.flatMap((f) => eventsInCell(db, f).filter((e) => db.refTime - e.t <= 7 * DAY).slice(0, 3)) : rows.slice(0, 20)).slice(0, 20).map((e) => ({ id: e.id, title: e.title, time: isoMin(e.t), value: e.mag !== null ? `${e.mag} ${e.unit ?? ''}` : undefined, url: e.url })),
      limitations: [`${db.label}. Live API counts (if shown) cover today's window and can differ.`, 'Statistical alerts only, no forecasting, not an official warning.'],
      patterns: plan.intent === 'anomaly' ? ['anomaly', 'change', 'review'] : ['anomaly', 'fusion', 'review'],
      createdAt: new Date().toISOString(),
    };
    mark(plan.intent === 'anomaly' ? 4 : 5, 'done');
  } else if (plan.intent === 'analog') {
    const s = await loadPowerSnapshot();
    const world = /moon|lunar/i.test(question) ? WORLDS[1] : WORLDS[0];
    const ids = ['atacama', 'dryvalleys', 'deathvalley', 'iceland', 'svalbard', 'sahel', 'greenland', 'nile'];
    const scored = ids.map((id) => {
      const p = PLACES.find((x) => x.id === id)!;
      const par = s.places[id].parameter;
      const avg = (k: string) => { const v = Object.entries(par[k]).filter(([d, x]) => d.endsWith('13') && x > -900).map(([, x]) => x); return v.reduce((a, b) => a + b, 0) / v.length; };
      const site = { tempC: avg('T2M'), precipMmDay: avg('PRECTOTCORR'), solarMJ: avg('ALLSKY_SFC_SW_DWN') };
      return { p, site, ...analogScore(site, world) };
    }).sort((a, b) => b.score - a.score);
    mark(2, 'done', `${ids.length} sites from snapshot`);
    mark(3, 'done', `Best: ${scored[0].p.name}`);
    evidence = {
      id: `inv:${Date.now()}`, title: `Best Earth analogs for ${world.name}`, subtitle: 'Transfer engine', kind: 'transfer', status: 'sample',
      sources: [{ name: 'NASA POWER snapshot (Earth sites, 2001–2025 annual means)', url: 'https://power.larc.nasa.gov/', retrieved: s.retrieved_utc }, { name: `${world.name} reference profile`, url: 'https://mars.nasa.gov/mars-exploration/planets/mars/' }],
      window: { start: '2001', end: '2025', label: 'climatology' },
      confidence: { level: 'low', score: 0.4, rationale: 'Only 3 climate dimensions; target-world profile is approximate. Use as a shortlist, not a ranking of record.' },
      method: 'Weighted normalised distance on cold (45%), aridity (40%) and light (15%) → similarity 0–1.',
      metrics: scored.slice(0, 5).map((x) => ({ label: x.p.name, value: `${Math.round(x.score * 100)} · ${fmt(x.site.tempC, 1)} °C · ${fmt(x.site.precipMmDay, 2)} mm/d`, status: 'snapshot' as const })),
      limitations: [world.note, 'Overall status is SAMPLE because the target-world profile is reference data; Earth values are real snapshot data.'],
      patterns: ['transfer', 'change', 'review'], createdAt: new Date().toISOString(),
    };
    mark(4, 'done');
  } else {
    mark(2, 'skipped', 'No connector covers this question yet');
    evidence = {
      id: `inv:${Date.now()}`, title: 'Not covered by a connected dataset', kind: 'investigation', status: 'sample', sources: [], window: { start: '—', end: '—' },
      confidence: { level: 'low', score: 0, rationale: 'No data fetched.' }, method: 'Planner only.', metrics: [], limitations: plan.notes, patterns: ['review'], createdAt: new Date().toISOString(),
    };
  }
  const reviewIdx = plan.steps.findIndex((s) => s.label === 'Human review');
  if (reviewIdx >= 0) mark(reviewIdx, 'done', 'Queued as pending review');

  let narrative = deterministicNarrative(plan, evidence);
  let narrator: 'deterministic' | 'llm' = 'deterministic';
  if (opts.useLlm) { const n = await llmNarrate(question, evidence).catch(() => null); if (n) { narrative = n; narrator = 'llm'; } }
  return { id: `r${Date.now()}`, plan, evidence, extra, narrative, narrator, ranAt: new Date().toISOString() };
}

export function deterministicNarrative(plan: InvestigationPlan, e: EvidencePack) {
  const m = e.metrics.map((x) => `${x.label}: ${x.value} [${x.status}]`).slice(0, 4).join('; ');
  const where = plan.place?.name ?? 'the whole globe';
  const head = plan.intent === 'trend' ? `For ${where}, ORBIT computed ${plan.variables.map((v) => POWER_VARS[v].short.toLowerCase()).join(', ')} over ${e.window.start}–${e.window.end}.` : plan.intent === 'analog' ? `ORBIT ranked Earth analog sites against the target-world profile.` : plan.intent === 'unsupported' ? 'ORBIT has no connected dataset for this question yet.' : `ORBIT scanned ${where} over the last ${plan.days} days of the snapshot.`;
  return `${head} ${m}. Confidence is ${e.confidence.level}: ${e.confidence.rationale} This is a lead for human review, not a conclusion.`;
}
