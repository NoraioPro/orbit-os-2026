import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chip, Glass, Icon, StatusBadge } from '../components/ui';
import { SonifyButton } from '../components/SonifyButton';
import { FindingsVoice } from '../components/FindingsVoice';
import { Table, ViewSwitch, JsonPane, useDataSheet } from '../components/DataSheet';

/**
 * One place, five lenses — Svalbard.
 *
 * Earth Intelligence carries five challenge prototypes (C2 trend, C5 radar change,
 * C6 rotation planning, C8 fire harmonisation, C14 sonification). They are usually
 * read as five separate demos. This page points all five at the same real place so
 * the difference between them is visible: same coordinates, same sources, five
 * questions. Every figure comes from the files the individual panels use; the fire
 * lens reports what the harvest actually contains rather than inventing a signal.
 */

interface Trends { regions: { id: string; label: string; area_months: Record<string, [number, number][]>; stats_by_month: { month: number; slope_km2_per_decade: number; latest_km2: number; latest_year: number; climatology_1991_2020_km2: number | null }[] }[] }
interface Norway { generated_at: string; aois: { id: string; name: string; forecast?: { now?: { airTempC: number | null; windMs: number | null }; hours?: { at: string; airTempC: number | null }[] }; ocean?: { seaWaterTempC?: number | null; waveHeightM?: number | null }; sun?: { polar?: string | null }; flood_warnings?: { count?: number }; landslide_warnings?: { count?: number } }[] }
interface Event { type?: string; lat?: number; lon?: number; t?: number; mag?: number }
interface Sar { aois: { id: string; name: string; queries: { platform: string; count: number }[] }[] }

const LAT = 78.2232;
const LON = 15.6469;
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

function Spark({ series, color = '#38bdf8' }: { series: [number, number][]; color?: string }) {
  if (series.length < 2) return <div className="text-[9px] text-slate-500">no series</div>;
  const xs = series.map((p) => p[0]);
  const ys = series.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const px = (v: number) => ((v - minX) / (maxX - minX || 1)) * 216 + 2;
  const py = (v: number) => 52 - ((v - minY) / (maxY - minY || 1)) * 44;
  return (
    <svg viewBox="0 0 220 58" className="w-full" role="img" aria-label="series">
      <path d={series.map((p, i) => `${i ? 'L' : 'M'}${px(p[0]).toFixed(1)},${py(p[1]).toFixed(1)}`).join(' ')} fill="none" stroke={color} strokeWidth="1.5" />
      <text x="2" y="9" fontSize="7" fill="#64748b">{fmt(maxY)}</text>
      <text x="2" y="56" fontSize="7" fill="#475569">{fmt(minY)}</text>
    </svg>
  );
}

function Lens({ code, name, color, children, source }: { code: string; name: string; color: string; children: React.ReactNode; source: string }) {
  return (
    <Glass className="flex flex-col p-2.5">
      <div className="flex items-center justify-between">
        <span className={`text-[9px] font-semibold uppercase tracking-[0.1em] ${color}`}>{code} · {name}</span>
      </div>
      <div className="mt-1 flex-1">{children}</div>
      <div className="mt-1 text-[8px] leading-snug text-slate-500">{source}</div>
    </Glass>
  );
}

export function SvalbardLenses() {
  const [trends, setTrends] = useState<Trends | null>(null);
  const [nor, setNor] = useState<Norway | null>(null);
  const [sar, setSar] = useState<Sar | null>(null);
  const [fires, setFires] = useState<{ n: number; at: string } | null>(null);
  const [live, setLive] = useState<{ n: number; latest: string | null } | null>(null);
  const sheet = useDataSheet('/data/norway/index.json');

  useEffect(() => {
    const get = <T,>(p: string, set: (v: T) => void) =>
      fetch(p).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))).then(set).catch(() => {});
    void get<Trends>('/data/ice/trends.json', setTrends);
    void get<Norway>('/data/norway/index.json', setNor);
    void get<Sar>('/data/domains/sar.json', setSar);
    // C8: what does the fire harvest actually hold near this coordinate?
    fetch('/data/live/events.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: unknown) => {
        const rows: Event[] = Array.isArray(d) ? (d as Event[]) : ((d as { events?: Event[] }).events ?? []);
        const near = rows.filter((e) => (e.type ?? '').includes('wild') || (e.type ?? '').includes('fire')).filter((e) => typeof e.lat === 'number' && typeof e.lon === 'number' && Math.abs(e.lat - LAT) < 2 && Math.abs(((e.lon - LON) % 360)) < 2);
        setFires({ n: near.length, at: new Date().toISOString() });
      })
      .catch(() => setFires(null));
    // C5: live ASF metadata for the same point
    fetch('https://api.daac.asf.alaska.edu/services/search/param?platform=NISAR,SENTINEL-1&intersectsWith=POINT(15.65%2078.22)&output=json&maxResults=50')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: unknown) => {
        const rows = (Array.isArray(d) && Array.isArray(d[0]) ? d[0] : Array.isArray(d) ? d : []) as { startTime?: string }[];
        const ds = rows.map((g) => g.startTime).filter(Boolean).sort() as string[];
        setLive({ n: rows.length, latest: ds[ds.length - 1] ?? null });
      })
      .catch(() => setLive(null));
  }, []);

  const barents = trends?.regions.find((r) => r.id === 'barents');
  const sept = barents?.stats_by_month.find((s) => s.month === 9);
  const septSeries = barents?.area_months['9'] ?? [];
  const svalbard = nor?.aois.find((a) => a.id === 'longyearbyen');
  const barentsSea = nor?.aois.find((a) => a.id === 'barents');
  const now = svalbard?.forecast?.now;
  const temps = (svalbard?.forecast?.hours ?? []).map((h) => h.airTempC).filter((v): v is number => v !== null);

  const conclusion = useMemo(() => {
    const bits = [
      sept ? `Barents September ice is ${Math.abs(sept.slope_km2_per_decade).toLocaleString('en-US')} km² per decade lower and stood at ${fmt(sept.latest_km2)} km² in ${sept.latest_year}` : null,
      now?.airTempC != null ? `Longyearbyen is ${now.airTempC.toFixed(1)} °C with ${now.windMs?.toFixed(1)} m/s wind${svalbard?.sun?.polar ? ' in polar night' : ''}` : null,
      live ? `ASF holds ${live.n} radar scenes over the point` : null,
      fires ? (fires.n ? `${fires.n} fire detections within 2° in the harvest` : 'no fire detections within 2° in the harvest') : null,
    ].filter(Boolean);
    return bits.join('; ') + '. Five lenses, one place, no figure without its provider.';
  }, [sept, now, svalbard, live, fires]);

  return (
    <div className="space-y-3">
      <Glass className="p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Icon name="Snowflake" className="h-4 w-4 text-sky-300" />
              <span className="text-[14px] font-semibold text-white">One place, five lenses · Svalbard 78.22°N 15.65°E</span>
              <StatusBadge status="live" note="real data only" />
            </div>
            <p className="mt-0.5 max-w-3xl text-[11px] leading-snug text-slate-400">
              The same coordinate read through the five capabilities Earth Intelligence carries. Each lens keeps its own source and its own limits — the point is that one place can be answered five ways without five portals.
            </p>
          </div>
          <div className="flex items-center gap-1">
            <FindingsVoice text={conclusion} label="Read the conclusion" className="btn-ghost !py-1 text-[10px]" />
            <ViewSwitch open={sheet.open} setOpen={sheet.setOpen} jsonUrl="/data/norway/index.json" />
          </div>
        </div>
      </Glass>

      <div className="grid gap-2 lg:grid-cols-3">
        <Lens code="C2" name="Trend detective" color="text-indigo-300" source="public/data/ice/trends.json · NSIDC v4.0">
          <div className="text-[11px] text-slate-300">
            {sept ? <>September ice in the Barents: <b className="text-white">{fmt(sept.latest_km2)} km²</b> in {sept.latest_year} against <b className="text-white">{fmt(sept.climatology_1991_2020_km2 ?? 0)}</b> climatology.</> : 'Loading NSIDC series…'}
          </div>
          <div className="mt-1"><Spark series={septSeries} color="#818cf8" /></div>
          {sept && <div className="text-[10px] text-indigo-300">{sept.slope_km2_per_decade.toLocaleString('en-US')} km²/decade · 1978→{sept.latest_year}</div>}
        </Lens>

        <Lens code="C5" name="Radar surface change" color="text-teal-300" source="NASA ASF Search API (keyless) + /data/domains/sar.json">
          <div className="text-[11px] text-slate-300">
            {live ? <><b className="text-white">{live.n}</b> scenes over this point, newest pass <b className="text-white">{live.latest?.slice(0, 10) ?? '—'}</b>.</> : 'Querying ASF…'}
          </div>
          <div className="mt-1 space-y-0.5 text-[10px] text-slate-400">
            {(sar?.aois ?? []).flatMap((a) => a.queries.map((q) => ({ aoi: a.name, ...q }))).filter((q) => /svalbard|oslo/i.test(q.aoi)).slice(0, 4).map((q, i) => (
              <div key={i} className="flex justify-between"><span>{q.aoi} · {q.platform}</span><span className="text-slate-200">{q.count}</span></div>
            ))}
          </div>
          <div className="mt-1 text-[9px] text-slate-500">A pair is needed before any change can be claimed.</div>
        </Lens>

        <Lens code="C6" name="Rotation &amp; operations" color="text-amber-300" source="public/data/norway/index.json · MET Norway + NVE">
          <div className="text-[11px] text-slate-300">
            {now?.airTempC != null ? <><b className="text-white">{now.airTempC.toFixed(1)} °C</b>, wind <b className="text-white">{now.windMs?.toFixed(1)} m/s</b>{svalbard?.sun?.polar ? ', polar night' : ''}</> : 'Loading MET Norway…'}
          </div>
          {temps.length > 1 && <div className="mt-1"><Spark series={temps.map((t, i) => [i, t] as [number, number])} color="#fbbf24" /></div>}
          <div className="mt-1 text-[9px] text-slate-400">
            NVE warnings: flood {svalbard?.flood_warnings?.count ?? '—'} · landslide {svalbard?.landslide_warnings?.count ?? '—'}
            {barentsSea?.ocean?.waveHeightM != null ? ` · Barents swell ${barentsSea.ocean.waveHeightM} m` : ''}
          </div>
        </Lens>

        <Lens code="C8" name="Fire harmoniser" color="text-rose-300" source="public/data/live/events.json · FIRMS/EONET harvest">
          <div className="text-[11px] text-slate-300">
            {fires ? (fires.n ? <> {fires.n} detections within 2° of the point.</> : <> <b className="text-white">0</b> detections within 2° of the point in the harvest — the lens stays empty rather than inventing a signal.</>) : 'No fire harvest available for this AOI.'}
          </div>
          <div className="mt-1 text-[9px] text-slate-500">
            {fires ? `checked ${fires.at.slice(0, 16).replace('T', ' ')} UTC` : 'the global fire feed is not routed to Arctic AOIs in this build'}
          </div>
        </Lens>

        <Lens code="C14" name="Sonification" color="text-violet-300" source="the same series, played as pitch">
          <div className="text-[11px] text-slate-300">
            {temps.length ? <>Hear the {temps.length}-hour temperature trace as pitch — lower notes are colder hours.</> : 'Waiting for the temperature trace…'}
          </div>
          <div className="mt-1"><SonifyButton values={temps} label="Play the trace" className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2 py-0.5 text-[10px] text-violet-200 hover:bg-violet-500/10" /></div>
          <div className="mt-1 text-[9px] text-slate-500">One note per hour · 180 ms · no audio is pre-recorded.</div>
        </Lens>

        <Lens code="—" name="What no lens can do here" color="text-slate-400" source="module honesty notes">
          <ul className="space-y-0.5 text-[10px] text-slate-400">
            <li>· InSAR displacement — needs an unwrapped SLC pair</li>
            <li>· ice thickness — the chart gives extent and class, not thickness</li>
            <li>· seasonal forecast — NSIDC gives history, not prediction</li>
          </ul>
          <div className="mt-1 text-[9px] text-slate-500">Stated rather than filled with a plausible number.</div>
        </Lens>
      </div>

      <Glass className="p-3">
        <div className="flex items-start gap-2">
          <Icon name="Sparkles" className="mt-0.5 h-3.5 w-3.5 text-sky-300" />
          <div>
            <div className="text-[10px] uppercase tracking-[0.1em] text-sky-300">One conclusion</div>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-200">{conclusion}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              <Chip>5 lenses</Chip>
              <Chip>1 coordinate</Chip>
              <Chip>0 invented figures</Chip>
              {sept && <a className="text-[9px] text-sky-400 hover:underline" href="/data/ice/trends.json" target="_blank" rel="noreferrer">trends.json ↗</a>}
            </div>
          </div>
        </div>
      </Glass>
    </div>
  );
}

export default SvalbardLenses;
