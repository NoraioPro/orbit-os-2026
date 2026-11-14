import { useEffect, useState } from 'react';
import { LineChart } from '../components/LineChart';
import { sonify } from '../components/sonify';
import { ConfidencePill, Glass, Icon, StatusBadge } from '../components/ui';
import { trendEvidence } from '../data/evidence';
import { getPowerSeries, PLACES, POWER_VARS } from '../data/power';
import { forecastSeries, type EvidencePack, type Forecast } from '../kernel';
import { useStore } from '../state/store';

/** The lead widget: Earth Pulse change engine on NASA POWER (live → snapshot). */
export function EarthPulse({ defaultPlace = 'norway', defaultVar = 'T2M', vars = Object.keys(POWER_VARS), title = 'ORBIT Earth Pulse · change engine' }: { defaultPlace?: string; defaultVar?: string; vars?: string[]; title?: string }) {
  const { settings, openEvidence } = useStore();
  const [place, setPlace] = useState(defaultPlace);
  const [v, setV] = useState(defaultVar);
  const [from, setFrom] = useState(2001);
  const [pack, setPack] = useState<EvidencePack | null>(null);
  const [fc, setFc] = useState<Forecast | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = () => {
    const p = PLACES.find((x) => x.id === place)!;
    setBusy(true); setErr(null);
    getPowerSeries({ lat: p.lat, lon: p.lon, name: p.name, placeId: p.id, variable: v, from, to: 2025, preferLive: settings.preferLive })
      .then((s) => { setPack(trendEvidence(s, 5)); setFc(forecastSeries(s.annual, { horizon: 10, period: 1 })); }).catch((e) => setErr(String(e.message || e))).finally(() => setBusy(false));
  };
  useEffect(run, [place, v, from]);
  return (
    <Glass className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="h-title">{title}</div>
        <div className="flex flex-wrap gap-2 text-xs">
          <select aria-label="Place" className="input !w-auto !py-1" value={place} onChange={(e) => setPlace(e.target.value)}>{PLACES.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <select aria-label="Variable" className="input !w-auto !py-1" value={v} onChange={(e) => setV(e.target.value)}>{vars.map((k) => <option key={k} value={k}>{POWER_VARS[k].short}</option>)}</select>
          <select aria-label="Start year" className="input !w-auto !py-1" value={from} onChange={(e) => setFrom(+e.target.value)}>{[1991, 2001, 2006, 2011].map((y) => <option key={y} value={y}>{y}–2025</option>)}</select>
        </div>
      </div>
      {err && <p className="mt-3 text-sm text-rose-300">{err}</p>}
      {busy && !pack && <p className="mt-3 text-sm text-slate-400">Fetching NASA POWER…</p>}
      {pack && (
        <div className={`mt-3 ${busy ? 'opacity-50' : ''}`}>
          <div className="flex flex-wrap items-center gap-2 text-sm"><b className="text-white">{pack.title}</b><StatusBadge status={pack.status} /><ConfidencePill level={pack.confidence.level} /></div>
          <div className="mt-2 grid grid-cols-5 gap-2">{pack.metrics.map((m, i) => <div key={i} className="rounded-lg border border-white/10 bg-white/[.03] p-2"><div className="truncate text-[10px] text-slate-400">{m.label}</div><div className="text-[13px] font-semibold text-white">{m.value}</div></div>)}</div>
          <LineChart points={pack.series!.points} trend={pack.series!.trend} unit={pack.series!.unit} height={170} />
          {fc?.ok && (
            <div className="mt-2 rounded-lg border border-violet-400/25 bg-violet-500/5 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold text-violet-200">Forecast · next {fc.horizon} yr <span className="font-normal text-violet-300/70">(statistical)</span></div>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${fc.divergence.level === 'normal' ? 'bg-emerald-500/20 text-emerald-200' : fc.divergence.level === 'watch' ? 'bg-amber-500/20 text-amber-200' : 'bg-rose-500/20 text-rose-200'}`}>{fc.divergence.level}</span>
              </div>
              <LineChart points={pack.series!.points} forecast={fc.forecast} unit={pack.series!.unit} height={140} color="#a78bfa" />
              <p className="mt-1 text-[11px] text-violet-100/80">{fc.divergence.text}</p>
              <p className="mt-1 text-[10px] leading-relaxed text-slate-400"><b className="text-violet-200/80">Why it matters:</b> a trend only looks back; a forecast turns it into an early signal. If the next reading lands outside this band, that is a divergence to investigate — not proof of anything. {fc.limitations[0]}</p>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary !py-1.5" onClick={() => openEvidence(pack)}><Icon name="ShieldCheck" />Evidence pack</button>
            <button className="btn-ghost !py-1.5" onClick={() => sonify(pack.series!.points)}><Icon name="Music" />Listen (challenge 14)</button>
          </div>
        </div>
      )}
    </Glass>
  );
}
