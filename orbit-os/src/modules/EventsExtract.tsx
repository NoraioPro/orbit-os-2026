import { useEffect, useMemo, useState } from 'react';
import { Chip, Glass, Icon, StatusBadge } from '../components/ui';
import { downloadCsv, downloadJson } from '../data/export';

type EventsMeta = {
  records: number;
  by_type: Record<string, number>;
  label: string;
};

type EventsData = {
  meta: EventsMeta;
  cols: string[];
  rows: unknown[][];
};

const TYPE_STYLE: Record<string, { label: string; chip: string }> = {
  earthquake: { label: 'Earthquakes', chip: 'border-amber-400/30 bg-amber-500/10 text-amber-200' },
  severeStorms: { label: 'Severe storms', chip: 'border-violet-400/30 bg-violet-500/10 text-violet-200' },
  wildfires: { label: 'Wildfires', chip: 'border-orange-400/30 bg-orange-500/10 text-orange-200' },
  floods: { label: 'Floods', chip: 'border-sky-400/30 bg-sky-500/10 text-sky-200' },
  seaLakeIce: { label: 'Sea & lake ice', chip: 'border-cyan-400/30 bg-cyan-500/10 text-cyan-200' },
  volcanoes: { label: 'Volcanoes', chip: 'border-rose-400/30 bg-rose-500/10 text-rose-200' },
  other: { label: 'Other', chip: 'border-slate-400/30 bg-slate-500/10 text-slate-300' },
};

const typeLabel = (t: unknown) => TYPE_STYLE[String(t ?? '')]?.label ?? String(t ?? 'unknown');

/** Self-contained natural-events data extraction panel (EONET v3 + USGS live harvest). */
export function EventsExtract() {
  const [data, setData] = useState<EventsData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/data/live/events.json')
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((json: EventsData) => { if (alive) setData(json); })
      .catch((e) => { if (alive) setErr(String(e?.message || e)); });
    return () => { alive = false; };
  }, []);

  const rowsAsObjects = useMemo(() => {
    if (!data) return [] as Record<string, unknown>[];
    return data.rows.map((row) => {
      const obj: Record<string, unknown> = {};
      data.cols.forEach((c, i) => { obj[c] = row[i]; });
      return obj;
    });
  }, [data]);

  const recent = useMemo(() => {
    if (!data) return [] as Record<string, unknown>[];
    return rowsAsObjects
      .slice()
      .sort((a, b) => Number(b.t ?? 0) - Number(a.t ?? 0))
      .slice(0, 10);
  }, [rowsAsObjects]);

  if (err) return <Glass className="p-4 text-sm text-rose-300">Events extract unavailable ({err}). Check the live harvest and reload.</Glass>;
  if (!data) return <Glass className="p-4 text-sm text-slate-400">Loading live events (EONET + USGS)…</Glass>;

  const magDisplay = (r: Record<string, unknown>) => {
    const m = r.mag;
    if (m == null || m === '') return '—';
    return r.unit ? `${m} ${r.unit}` : String(m);
  };

  return (
    <Glass className="p-4">
      {/* (1) header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="h-title">Natural events</div>
          <StatusBadge status="live" note="NASA EONET v3 + USGS" />
        </div>
        <div className="text-xs text-slate-400">
          <span className="font-semibold text-white">{data.meta.records.toLocaleString('en-US')}</span> records
        </div>
      </div>

      {/* (2) by_type breakdown */}
      <div className="mt-2 flex flex-wrap gap-2">
        {Object.entries(data.meta.by_type).map(([k, n]) => {
          const m = TYPE_STYLE[k] ?? TYPE_STYLE.other;
          return (
            <Chip key={k} className={m.chip}>
              <span className="font-semibold">{m.label}</span>
              <span className="opacity-70">{n.toLocaleString('en-US')}</span>
            </Chip>
          );
        })}
      </div>

      {/* (3) sample preview table */}
      <div className="mt-3">
        <div className="text-[11px] text-slate-400">10 most recent events</div>
        <div className="scroll-thin mt-1 overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-xs">
            <thead className="bg-slate-900 text-left text-slate-400">
              <tr>
                <th className="p-2">Title</th>
                <th className="p-2">Type</th>
                <th className="p-2">Mag</th>
                <th className="p-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={String(r.id)} className="border-t border-white/5 hover:bg-sky-500/10">
                  <td className="max-w-[320px] truncate p-2 font-medium text-white">{String(r.title ?? '')}</td>
                  <td className="p-2 text-slate-300">{typeLabel(r.type)}</td>
                  <td className="p-2 text-slate-300">{magDisplay(r)}</td>
                  <td className="p-2 text-slate-300">{new Date(Number(r.t)).toISOString().slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* (4) export buttons */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn-primary !py-1.5" onClick={() => downloadJson('events.json', data)}>
          <Icon name="FileText" className="h-4 w-4" />Export JSON
        </button>
        <button className="btn-ghost !py-1.5" onClick={() => downloadCsv('events.csv', rowsAsObjects, data.cols)}>
          <Icon name="Download" className="h-4 w-4" />Export CSV
        </button>
      </div>
    </Glass>
  );
}
