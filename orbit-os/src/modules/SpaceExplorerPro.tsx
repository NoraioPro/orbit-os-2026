import { useEffect, useState } from 'react';
import { Chip, Glass, Icon, PageHeader, StatusBadge } from '../components/ui';
import { loadPowerSnapshot, PLACES } from '../data/power';
import { analogScore, WORLDS } from '../kernel';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

interface AnalogRow {
  id: string;
  name: string;
  country: string;
  tempC: number;
  precipMmDay: number;
  solarMJ: number;
  mars: { score: number; parts: { cold: number; aridity: number; light: number } };
  moon: { score: number; parts: { cold: number; aridity: number; light: number } };
}

interface LunarSite {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** Illustrative % of a lunar year a site stays sunlit (SAMPLE). */
  sunPct: number;
  /** Illustrative direct-to-Earth comms availability (SAMPLE). */
  earthVis: 'Continuous' | 'Mostly' | 'Intermittent';
  note: string;
}

interface NasaImage { url: string; title: string; id: string; date: string }

type WorldKey = 'mars' | 'moon';

const ANALOG_IDS = ['atacama', 'dryvalleys', 'deathvalley', 'iceland', 'svalbard', 'sahel', 'greenland', 'nile', 'andoya'];

/**
 * Curated lunar south-pole candidate sites (challenge 11). Site names and
 * coordinates are real published features / landing candidates; the Sun and
 * Earth visibility figures are ILLUSTRATIVE reference values (SAMPLE), not
 * mission measurements. Label the numbers honestly.
 */
const LUNAR_SITES: LunarSite[] = [
  { id: 'shackleton', name: 'Shackleton crater rim', lat: -89.9, lon: 0.0, sunPct: 85, earthVis: 'Intermittent', note: 'Elevated rim points stay sunlit most of the year while the crater floor is a permanently shadowed region (PSR) with possible water ice.' },
  { id: 'malapert', name: 'Malapert Massif', lat: -86.0, lon: 2.7, sunPct: 50, earthVis: 'Continuous', note: 'High near-side plateau with near-continuous Earth line-of-sight for direct communications.' },
  { id: 'nobile', name: 'Nobile crater rim', lat: -85.2, lon: 53.5, sunPct: 50, earthVis: 'Mostly', note: "NASA's VIPER rover landing site (announced 2021); chosen to balance sunlight access with Earth visibility." },
  { id: 'degerlache', name: 'de Gerlache crater rim', lat: -88.5, lon: 88.0, sunPct: 50, earthVis: 'Intermittent', note: 'One of NASA Artemis III candidate landing regions near the south pole.' },
  { id: 'faustini', name: 'Faustini crater rim', lat: -87.3, lon: 77.0, sunPct: 45, earthVis: 'Intermittent', note: 'Rim site adjacent to a large permanently shadowed crater floor, a water-ice survey target.' },
  { id: 'leibnitz', name: 'Leibnitz Beta Plateau', lat: -85.0, lon: 30.0, sunPct: 40, earthVis: 'Intermittent', note: 'Elevated polar highlands plateau studied in lunar illumination surveys.' },
];

const EARTH_VIS_STYLE: Record<LunarSite['earthVis'], string> = {
  Continuous: 'text-emerald-300 border-emerald-400/30 bg-emerald-500/10',
  Mostly: 'text-sky-300 border-sky-400/30 bg-sky-500/10',
  Intermittent: 'text-amber-300 border-amber-400/30 bg-amber-500/10',
};

const fmtLat = (lat: number) => `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}`;
const fmtLon = (lon: number) => `${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`;

/* ------------------------------------------------------------------ */
/* Small presentational pieces                                          */
/* ------------------------------------------------------------------ */

function ScoreBar({ v, color }: { v: number; color: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(v * 100)));
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 rounded bg-white/10">
        <div className="h-1.5 rounded" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="tabular-nums">{pct}</span>
    </div>
  );
}

function SampleNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-400/25 bg-amber-500/5 p-2 text-[11px] text-amber-200">
      <StatusBadge status="sample" />
      <span>{children}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Challenge 9 — Earth Analog Ranker                                    */
/* ------------------------------------------------------------------ */

function AnalogRanker() {
  const [rows, setRows] = useState<AnalogRow[]>([]);
  const [world, setWorld] = useState<WorldKey>('mars');
  const [err, setErr] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ retrieved: string; from: number; to: number } | null>(null);

  useEffect(() => {
    let alive = true;
    loadPowerSnapshot()
      .then((s) => {
        if (!alive) return;
        const parsed: AnalogRow[] = ANALOG_IDS.map((id) => {
          const rec = s.places[id];
          const par = rec.parameter;
          const avg = (k: string) => {
            const v = Object.entries(par[k]).filter(([d, x]) => d.endsWith('13') && x > -900).map(([, x]) => x);
            return v.reduce((a, b) => a + b, 0) / v.length;
          };
          const site = { tempC: avg('T2M'), precipMmDay: avg('PRECTOTCORR'), solarMJ: avg('ALLSKY_SFC_SW_DWN') };
          const place = PLACES.find((p) => p.id === id);
          return { id, name: place?.name ?? id, country: place?.country ?? '', ...site, mars: analogScore(site, WORLDS[0]), moon: analogScore(site, WORLDS[1]) };
        });
        setRows(parsed);
        setMeta({ retrieved: s.retrieved_utc, from: s.start, to: s.end });
      })
      .catch((e: any) => setErr(String(e?.message || e)));
    return () => { alive = false; };
  }, []);

  const sorted = [...rows].sort((a, b) => (world === 'mars' ? b.mars.score - a.mars.score : b.moon.score - a.moon.score));
  const active = world === 'mars' ? WORLDS[0] : WORLDS[1];

  return (
    <Glass className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="h-title">Earth analog ranker (challenge 9)</div>
          {meta && <StatusBadge status="snapshot" note={`NASA POWER ${meta.from}–${meta.to} means`} />}
        </div>
        <div className="flex gap-1 text-xs">
          {(['mars', 'moon'] as WorldKey[]).map((w) => (
            <button
              key={w}
              onClick={() => setWorld(w)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 ${world === w ? 'border-indigo-400/50 bg-indigo-500/20 text-white' : 'border-white/10 text-slate-400 hover:bg-white/5'}`}
            >
              <Icon name={w === 'mars' ? 'Mars' : 'Moon'} className="h-3.5 w-3.5" />
              Rank by {w === 'mars' ? 'Mars' : 'Moon'}
            </button>
          ))}
        </div>
      </div>

      {err && <p className="mt-2 text-xs text-rose-300">Could not load the POWER snapshot: {err}. ORBIT will not invent values.</p>}

      {/* Reference profiles (SAMPLE) */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {WORLDS.map((w) => (
          <div key={w.id} className={`rounded-lg border p-2 ${world === w.id ? 'border-indigo-400/40 bg-indigo-500/10' : 'border-white/10 bg-white/[.03]'}`}>
            <div className="flex items-center gap-2 text-xs font-semibold text-white"><Icon name={w.id === 'mars' ? 'Mars' : 'Moon'} className="h-4 w-4 text-indigo-300" />{w.name}</div>
            <div className="mt-1 grid grid-cols-3 gap-1 text-[11px] text-slate-300">
              <span>Temp <b className="text-white">{w.meanTempC}°C</b></span>
              <span>Precip <b className="text-white">{w.precipMmDay} mm/d</b></span>
              <span>Solar <b className="text-white">{w.solarMJ} MJ</b></span>
            </div>
            <div className="mt-1 text-[10px] text-slate-500">{w.note}</div>
          </div>
        ))}
      </div>

      <SampleNote>
        Earth columns are real NASA POWER means (<StatusBadge status="snapshot" />). The <b>Mars / Moon scores are SAMPLE</b> — the target-world
        profiles are approximate reference values, so a score is a similarity index, not a mission ranking.
      </SampleNote>

      {rows.length === 0 && !err ? (
        <p className="text-xs text-slate-400">Loading POWER snapshot…</p>
      ) : (
        <div className="scroll-thin mt-2 max-h-80 overflow-y-auto rounded-xl border border-white/10">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-900 text-left text-slate-400">
              <tr>
                <th className="p-2">#</th>
                <th>Earth site</th>
                <th>Mean T (°C)</th>
                <th>Precip (mm/d)</th>
                <th>Solar (MJ/d)</th>
                <th>Mars</th>
                <th>Moon</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="p-2 tabular-nums text-slate-400">{i + 1}</td>
                  <td className="py-1.5">
                    <span className="text-slate-200">{r.name}</span>
                    <span className="ml-1 text-[10px] text-slate-500">{r.country}</span>
                  </td>
                  <td className="tabular-nums">{r.tempC.toFixed(1)}</td>
                  <td className="tabular-nums">{r.precipMmDay.toFixed(2)}</td>
                  <td className="tabular-nums">{r.solarMJ.toFixed(1)}</td>
                  <td><ScoreBar v={r.mars.score} color="#f97316" /></td>
                  <td><ScoreBar v={r.moon.score} color="#cbd5e1" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-2 text-[11px] text-slate-500">
        Ranked by <b className="text-slate-300">{active.name}</b> similarity. Kernel: <code className="text-indigo-200">analogScore(site, world)</code> — normalised
        distance on cold, aridity and light (weights 0.45 / 0.40 / 0.15). The transfer pattern: validate the change engine at the top Earth analog,
        then run the same pipeline on lunar/Martian imagery (LRO, MRO) — off-world connectors are planned.
      </p>
    </Glass>
  );
}

/* ------------------------------------------------------------------ */
/* Challenge 11 — Lunar Site Navigator                                  */
/* ------------------------------------------------------------------ */

function LunarNavigator() {
  const [img, setImg] = useState<NasaImage | null>(null);
  const [imgStatus, setImgStatus] = useState<'loading' | 'live' | 'error'>('loading');

  // Live NASA image for the header (Image & Video Library).
  useEffect(() => {
    let alive = true;
    fetch('https://images-api.nasa.gov/search?q=lunar%20south%20pole&media_type=image')
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then((json: any) => {
        const items: any[] = json?.collection?.items ?? [];
        if (!items.length) throw new Error('no results');
        const it = items.find((x: any) => /lunar|moon|pole/i.test(String(x?.data?.[0]?.title ?? ''))) ?? items[0];
        const links: any[] = it?.links ?? [];
        const url: string | undefined =
          links.find((l: any) => l.rel === 'preview')?.href ?? links.find((l: any) => l.rel === 'alternate')?.href ?? links[0]?.href;
        const data = it?.data?.[0] ?? {};
        if (!url) throw new Error('no image link');
        if (alive) {
          setImg({ url, title: data.title ?? 'Lunar south pole', id: data.nasa_id ?? '—', date: data.date_created ?? '' });
          setImgStatus('live');
        }
      })
      .catch(() => { if (alive) setImgStatus('error'); });
    return () => { alive = false; };
  }, []);

  return (
    <Glass className="p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="h-title">Lunar site navigator (challenge 11)</div>
        <StatusBadge status={imgStatus === 'live' ? 'live' : 'sample'} note={imgStatus === 'live' ? 'NASA Image & Video Library — live' : 'imagery loading/unavailable'} />
      </div>

      {/* Live NASA imagery */}
      <div className="relative mt-2 overflow-hidden rounded-xl border border-white/10">
        {img && <img src={img.url} alt={img.title} className="h-40 w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status="live" note="NASA Image & Video Library" />
            <Chip>images-api.nasa.gov</Chip>
          </div>
          <div className="mt-1 truncate text-xs font-semibold text-white">{img?.title ?? 'Lunar south pole'}</div>
          <div className="text-[10px] text-slate-300">
            {imgStatus === 'live' && img
              ? `NASA Image ${img.id} · ${img.date.slice(0, 10)} · NASA Image & Video Library`
              : imgStatus === 'error'
                ? 'Live lunar image unavailable right now — list shown without imagery.'
                : 'Fetching live lunar image from the NASA Image & Video Library…'}
          </div>
        </div>
      </div>

      <SampleNote>
        Site names and coordinates are real published lunar features / landing candidates. The <b>Sun and Earth visibility figures are SAMPLE
        reference values</b> used to illustrate the selection logic — not measured mission data.
      </SampleNote>

      <ul className="scroll-thin mt-2 max-h-96 space-y-2 overflow-y-auto">
        {LUNAR_SITES.map((s) => (
          <li key={s.id} className="rounded-lg border border-white/10 bg-white/[.03] p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-white">{s.name}</span>
              <span className="text-[10px] tabular-nums text-slate-400">{fmtLat(s.lat)} · {fmtLon(s.lon)}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="flex items-center gap-1 text-slate-300">
                <Icon name="Sparkles" className="h-3.5 w-3.5 text-amber-300" />Sunlight
                <span className="h-1.5 w-16 rounded bg-white/10"><span className="block h-1.5 rounded bg-amber-400" style={{ width: `${s.sunPct}%` }} /></span>
                <span className="tabular-nums text-white">~{s.sunPct}%</span>
              </span>
              <span className={`flex items-center gap-1 rounded-md border px-1.5 py-[1px] text-[10px] font-semibold uppercase ${EARTH_VIS_STYLE[s.earthVis]}`}>
                <Icon name="Earth" className="h-3 w-3" />{s.earthVis}
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{s.note}</p>
          </li>
        ))}
      </ul>

      <p className="mt-2 text-[11px] text-slate-500">
        Selection heuristics — sustained sunlight for power, Earth line-of-sight for comms, and adjacency to permanently shadowed regions (PSRs) for
        water-ice prospecting. LRO / LOLA illumination maps are the planned live source; current figures are illustrative.
      </p>
    </Glass>
  );
}

/* ------------------------------------------------------------------ */
/* Module shell                                                        */
/* ------------------------------------------------------------------ */

export function SpaceExplorerPro() {
  return (
    <div className="space-y-3">
      <PageHeader
        icon="Orbit"
        title="Space Explorer"
        subtitle="Earth analog → Moon/Mars transfer: rank Earth sites against off-world profiles, then survey lunar south-pole landing candidates."
        right={<StatusBadge status="snapshot" note="POWER snapshot + live NASA image; profiles & visibility are sample" />}
      />
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_420px]">
        <AnalogRanker />
        <LunarNavigator />
      </div>
    </div>
  );
}

export default SpaceExplorerPro;
