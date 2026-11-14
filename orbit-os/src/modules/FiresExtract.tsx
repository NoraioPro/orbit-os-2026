import { useEffect, useMemo, useState } from 'react';
import { Glass, Icon, StatusBadge } from '../components/ui';
import { downloadCsv, downloadJson } from '../data/export';

interface FirmsGrid {
  label: string;
  retrieved_at: string;
  time_range: { start: string; end: string };
  detections: number;
  cell_deg: number;
  cols: string[];
  cells: number[][];
  hottest_cols: string[];
}

type CellRow = Record<string, number>;

const toCellRow = (cell: number[], cols: string[]): CellRow => {
  const row: CellRow = {};
  cols.forEach((c, i) => (row[c] = cell[i] ?? 0));
  return row;
};

const fmtNum = (n: number) => n.toLocaleString('en-US');
const fmtCoord = (n: number) => `${Math.abs(n).toFixed(1)}°${n >= 0 ? 'N' : 'S'}`;

export function FiresExtract() {
  const [data, setData] = useState<FirmsGrid | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch('/data/live/firms-grid.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j: FirmsGrid) => setData(j))
      .catch((e) => setErr(String(e)));
  }, []);

  const rows = useMemo<CellRow[]>(() => (data ? data.cells.map((c) => toCellRow(c, data.cols)) : []), [data]);

  const top10 = useMemo(
    () => [...rows].sort((a, b) => (b.count ?? 0) - (a.count ?? 0)).slice(0, 10),
    [rows],
  );

  if (err) return <Glass className="p-4 text-xs text-slate-500">FIRMS grid unavailable ({err}).</Glass>;

  const range = data ? `${data.time_range.start.replace('T', ' ').replace('Z', '')} → ${data.time_range.end.replace('T', ' ').replace('Z', '')} UTC` : '';

  return (
    <Glass className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon name="Flame" className="h-4 w-4 text-orange-400" />
          <span className="h-title">Active fires (FIRMS)</span>
          <StatusBadge status="live" note="NASA LANCE MODIS+VIIRS, 24 h" />
        </div>
        <div className="flex items-center gap-2">
          <button className="btn !py-1 text-xs" onClick={() => data && downloadJson('firms-grid.json', data)}>
            <Icon name="Download" className="h-3.5 w-3.5" /> JSON
          </button>
          <button className="btn !py-1 text-xs" onClick={() => data && downloadCsv('firms-grid-cells.csv', rows, data.cols)}>
            <Icon name="Download" className="h-3.5 w-3.5" /> CSV
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-lg border border-white/10 bg-white/[.03] p-2">
          <div className="text-slate-400">Detections</div>
          <div className="mt-0.5 text-lg font-bold text-orange-300">{data ? fmtNum(data.detections) : '…'}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[.03] p-2">
          <div className="text-slate-400">1° cells</div>
          <div className="mt-0.5 text-lg font-bold text-white">{data ? fmtNum(data.cells.length) : '…'}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[.03] p-2">
          <div className="text-slate-400">Time range</div>
          <div className="mt-0.5 text-sm font-semibold text-white">{data ? range : '…'}</div>
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1 text-xs font-semibold text-slate-300">Top 10 cells by detection count</div>
        <table className="w-full text-xs">
          <thead className="text-left text-slate-400">
            <tr>
              <th className="py-1 pr-2">Lat</th>
              <th className="py-1 pr-2">Lon</th>
              <th className="py-1 pr-2 text-right">Detections</th>
              <th className="py-1 pr-2 text-right">FRP sum MW</th>
              <th className="py-1 pr-2 text-right">FRP max MW</th>
              <th className="py-1 text-right">Night</th>
            </tr>
          </thead>
          <tbody>
            {top10.map((c, i) => (
              <tr key={i} className="border-t border-white/5">
                <td className="py-1.5 pr-2 text-slate-300">{fmtCoord(c.lat)}</td>
                <td className="py-1.5 pr-2 text-slate-300">{fmtCoord(c.lon)}</td>
                <td className="py-1.5 pr-2 text-right font-semibold text-orange-300">{fmtNum(c.count)}</td>
                <td className="py-1.5 pr-2 text-right text-slate-300">{c.frp_sum_mw.toLocaleString('en-US', { maximumFractionDigits: 1 })}</td>
                <td className="py-1.5 pr-2 text-right text-slate-300">{c.frp_max_mw.toLocaleString('en-US', { maximumFractionDigits: 1 })}</td>
                <td className="py-1.5 text-right text-slate-400">{c.night}</td>
              </tr>
            ))}
            {!data && <tr><td colSpan={6} className="py-2 text-slate-500">Loading FIRMS grid…</td></tr>}
          </tbody>
        </table>
        <p className="mt-1 text-[10px] text-slate-500">
          {data ? `${data.label} · ${data.cell_deg}° grid · ${data.cells.length.toLocaleString('en-US')} populated cells · hottest columns: ${data.hottest_cols.join(', ')}` : '…'}
        </p>
      </div>
    </Glass>
  );
}
