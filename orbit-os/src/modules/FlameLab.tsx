import { useEffect, useMemo, useState } from 'react';
import { Glass, Icon, StatusBadge } from '../components/ui';

interface Inv { id: string; code: string; name: string; category: string; fuel: string; hardware: string; description: string; gravity: string; relevance: string; source_url: string; tags?: string[] }
interface Psi { investigation: string; psi_id: string; doi: string; license: string; summary: string; variables: string[]; outcomes: string[] }
interface Doc { ids: string[]; title: string; url: string; finding: string; limits: string }

const parseCsv = (text: string): Record<string, string>[] => {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = (cells[i] ?? '').trim()));
    return row;
  });
};

const csvRows = (rows: Record<string, string>[]) => rows.map((r) => ({
  investigation: r.investigation, material: r.material, gravity: r.gravity, direction: r.direction,
  oxygen: r.oxygen_pct, airflow: r.airflow_cm_s, spread: r.spread_mm_s, slide: r.slide,
}));

export function FlameLab() {
  const [flame, setFlame] = useState<ReturnType<typeof csvRows> | null>(null);
  const [invs, setInvs] = useState<Inv[]>([]);
  const [psi, setPsi] = useState<Psi[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [q, setQ] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const get = (p: string) => fetch(p).then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))));
    Promise.all([
      get('/data/ignis/saffire.csv'), get('/data/ignis/luci.csv'),
      fetch('/data/ignis/investigations.json').then((r) => r.json()),
      fetch('/data/ignis/psi_collections.json').then((r) => r.json()),
      fetch('/data/ignis/documents.json').then((r) => r.json()),
    ])
      .then(([saf, luci, inv, ps, dc]) => {
        setFlame(csvRows([...parseCsv(saf), ...parseCsv(luci)]));
        setInvs(inv); setPsi(ps); setDocs(dc);
      })
      .catch((e) => setErr(String(e)));
  }, []);

  const filtered = useMemo(() => {
    const t = q.toLowerCase();
    return t ? invs.filter((i) => (i.name + i.code + i.description + i.fuel + i.category + (i.tags ?? []).join(' ')).toLowerCase().includes(t)) : invs;
  }, [invs, q]);

  if (err) return <Glass className="p-4 text-xs text-slate-500">IGNIS combustion data unavailable ({err}).</Glass>;

  return (
    <Glass className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2"><Icon name="Flame" className="h-4 w-4 text-orange-400" /><span className="h-title">Flame in Freefall · real combustion data</span><StatusBadge status="live" note="NASA PSI / NTRS" /></div>
        <a className="text-xs text-sky-300 hover:underline" href="https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/" target="_blank" rel="noreferrer">challenge #7 ↗</a>
      </div>

      {flame && flame.length > 0 && (
        <div className="mt-3 rounded-lg border border-orange-400/20 bg-orange-500/[.04] p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold text-white">Spread-rate comparison · microgravity vs 1-g</div>
            <div className="flex gap-2 text-[9px] text-slate-400"><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#22d3ee]" />microgravity</span><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#a78bfa]" />lunar</span><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#fbbf24]" />1-g Earth</span></div>
          </div>
          <div className="mt-2 space-y-1.5">
            {[...flame].sort((a, b) => parseFloat(b.spread) - parseFloat(a.spread)).map((f) => {
              const v = parseFloat(f.spread) || 0;
              const max = Math.max(1, ...flame.map((x) => parseFloat(x.spread) || 0));
              const g = f.gravity.toLowerCase();
              const isEarth = g.includes('1-g') || g.includes('earth') || g.includes('1 g');
              const isLunar = g.includes('lunar') || g.includes('partial');
              const color = isEarth ? '#fbbf24' : isLunar ? '#a78bfa' : '#22d3ee';
              return (
                <div key={f.investigation} className="flex items-center gap-2">
                  <span className="w-44 shrink-0 truncate text-[10px] text-slate-400" title={`${f.investigation} · ${f.material}`}>{f.investigation} · {f.direction}</span>
                  <div className="relative h-3.5 flex-1 overflow-hidden rounded bg-white/5">
                    <div className="h-full rounded transition-all" style={{ width: `${(v / max) * 100}%`, background: `linear-gradient(90deg, ${color}55, ${color})` }} />
                  </div>
                  <span className="w-14 shrink-0 text-right text-[10px] tabular-nums font-semibold text-white">{v} <span className="font-normal text-slate-500">mm/s</span></span>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[10px] text-slate-500">Flame spreads <b className="text-slate-300">slower without gravity</b>: the microgravity and lunar measurements sit below the 1-g Earth reference — no buoyancy-driven airflow feeds the flame.</p>
        </div>
      )}

      <div className="mt-3 grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-3">
        <div className="space-y-3">
          <div>
            <div className="h-title mb-1 text-sm">Published flame-spread measurements (real)</div>
            <table className="w-full text-xs"><thead className="text-left text-slate-400"><tr><th className="py-1 pr-2">Experiment</th><th>Gravity</th><th>Direction</th><th>O₂</th><th>Spread</th></tr></thead>
              <tbody>{(flame ?? []).map((f, i) => (
                <tr key={i} className="border-t border-white/5"><td className="py-1.5 pr-2"><span className="text-slate-200">{f.investigation}</span><div className="text-[10px] text-slate-500">{f.material}</div></td><td className="text-slate-300">{f.gravity}</td><td className="text-slate-300">{f.direction}</td><td className="text-slate-300">{f.oxygen || '—'}</td><td className="font-semibold text-orange-300">{f.spread} mm/s</td></tr>
              ))}
              {!flame && <tr><td colSpan={5} className="py-2 text-slate-500">Loading measurements…</td></tr>}
              </tbody></table>
            <p className="mt-1 text-[10px] text-slate-500">Five published values: three Saffire-I/II SIBAL means (NTRS 20170008805) and two LUCI flame-base fits in lunar vs 1-g (NTRS 20250010653). Flame spreads <i>slower</i> without buoyancy-driven airflow.</p>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between"><span className="h-title text-sm">NASA PSI investigations ({invs.length})</span><input className="input !w-48 !py-1 text-xs" placeholder="Search investigations…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <ul className="scroll-thin max-h-56 space-y-1 overflow-y-auto text-xs">
              {filtered.map((i) => <li key={i.id} className="rounded border border-white/5 bg-white/[.02] p-2"><div className="flex items-center justify-between"><span className="font-semibold text-slate-200">{i.code} — {i.name}</span><span className="text-[10px] text-slate-500">{i.category} · {i.hardware}</span></div><div className="text-[11px] text-slate-400">{i.description}</div><div className="mt-0.5 text-[10px] text-slate-500">{i.gravity} · {i.fuel} · relevance {i.relevance}</div></li>)}
              {!filtered.length && <li className="p-2 text-slate-500">No investigation matches.</li>}
            </ul>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <div className="h-title mb-1 text-sm">PSI data collections ({psi.length})</div>
            <ul className="space-y-1.5 text-xs">{psi.map((p) => <li key={p.psi_id} className="rounded border border-white/5 bg-white/[.02] p-2"><div className="flex items-center justify-between"><span className="font-semibold text-slate-200">{p.psi_id}</span><a className="text-sky-300 hover:underline" href={`https://doi.org/${p.doi}`} target="_blank" rel="noreferrer">{p.doi}</a></div><div className="text-[11px] text-slate-400">{p.summary}</div><div className="mt-0.5 text-[10px] text-slate-500">{p.license} · variables: {p.variables.join(', ')}</div></li>)}</ul>
          </div>

          <div>
            <div className="h-title mb-1 text-sm">Source documents ({docs.length})</div>
            <ul className="scroll-thin max-h-48 space-y-1 overflow-y-auto text-[11px]">{docs.map((d, i) => <li key={i} className="rounded border border-white/5 bg-white/[.02] p-2"><a className="font-semibold text-sky-300 hover:underline" href={d.url} target="_blank" rel="noreferrer">{d.title}</a><div className="text-slate-400">{d.finding}</div></li>)}</ul>
          </div>

          <div className="rounded-lg border border-rose-400/25 bg-rose-500/5 p-2 text-[11px] text-rose-100"><b>Kept separate by design.</b> These are microgravity combustion measurements, not Earth wildfires — ORBIT never merges challenge #7 data with FIRMS/EONET fire data. Row-level provenance (source URL, slide locator, SHA-256) lives in the IGNIS source records. Absolute pressures and uncertainties are absent in the source publications.</div>
        </div>
      </div>
    </Glass>
  );
}
