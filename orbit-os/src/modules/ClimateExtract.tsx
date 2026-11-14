import { useEffect, useMemo, useState } from 'react';
import { downloadCsv, downloadJson } from '../data/export';
import { Glass, Icon, StatusBadge } from '../components/ui';

/* ------------------------------------------------------------------ *
 * ClimateExtract — "6-year daily climate history" data hub panel.
 * Fetches the harvested daily archive (Open-Meteo weather for 5 sites
 * + USGS M5+ earthquake counts) and presents compact summary tables,
 * a sample preview and JSON/CSV export.
 * ------------------------------------------------------------------ */

interface SiteDaily {
  site: string;
  lat: number;
  lon: number;
  time: string[];
  temp_max: (number | null)[];
  temp_min: (number | null)[];
  precip: (number | null)[];
  soil: (number | null)[];
}

interface DailyHistory {
  label: string;
  retrieved_at: string;
  time_range: { start: string; end: string };
  sites: SiteDaily[];
  earthquakes: { time: string[]; count: number[] };
  notes: string[];
}

interface SiteSummary {
  site: string;
  lat: number;
  lon: number;
  days: number;
  tMin: number;
  tMax: number;
  precip: number;
  soilMean: number; // fraction 0–1
}

const sum = (a: (number | null)[]) => a.reduce<number>((t, v) => t + (v ?? 0), 0);
const minOf = (a: (number | null)[]) => a.reduce<number>((m, v) => (v == null ? m : Math.min(m, v)), Infinity);
const maxOf = (a: (number | null)[]) => a.reduce<number>((m, v) => (v == null ? m : Math.max(m, v)), -Infinity);
const meanOf = (a: (number | null)[]) => {
  let t = 0;
  let n = 0;
  for (const v of a) if (v != null) { t += v; n += 1; }
  return n ? t / n : 0;
};

const fmt = (v: number, d = 1) => v.toFixed(d);

function summarize(s: SiteDaily): SiteSummary {
  return {
    site: s.site,
    lat: s.lat,
    lon: s.lon,
    days: s.time.length,
    tMin: minOf(s.temp_max),
    tMax: maxOf(s.temp_max),
    precip: sum(s.precip),
    soilMean: meanOf(s.soil),
  };
}

const CSV_COLUMNS = ['site', 'date', 'temp_max', 'temp_min', 'precip', 'soil'];

export function ClimateExtract() {
  const [data, setData] = useState<DailyHistory | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/data/live/daily-history.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<DailyHistory>;
      })
      .then((j) => { if (alive) setData(j); })
      .catch((e) => { if (alive) setErr(String(e?.message || e)); });
    return () => { alive = false; };
  }, []);

  const summaries = useMemo<SiteSummary[]>(() => (data ? data.sites.map(summarize) : []), [data]);

  const eqTotal = useMemo(() => (data ? sum(data.earthquakes.count) : 0), [data]);
  const eqDays = useMemo(() => (data ? data.earthquakes.time.length : 0), [data]);

  const first = data?.sites[0];
  const recent = useMemo(() => {
    if (!first) return [];
    return first.time
      .map((date, i) => ({ site: first.site, date, temp_max: first.temp_max[i], temp_min: first.temp_min[i], precip: first.precip[i], soil: first.soil[i] }))
      .slice(-5)
      .reverse();
  }, [first]);

  const flatRows = useMemo(() => {
    if (!first) return [];
    return first.time.map((date, i) => ({
      site: first.site,
      date,
      temp_max: first.temp_max[i],
      temp_min: first.temp_min[i],
      precip: first.precip[i],
      soil: first.soil[i],
    }));
  }, [first]);

  const doExportJson = () => { if (data) downloadJson('climate-daily-history.json', data); };
  const doExportCsv = () => { if (flatRows.length) downloadCsv('climate-oslo-daily.csv', flatRows, CSV_COLUMNS); };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon name="Snowflake" className="h-5 w-5 text-sky-300" />
          <h2 className="h-title">6-year daily climate history</h2>
          <StatusBadge status="live" note="Open-Meteo archive + USGS M5+" />
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost !py-1.5 text-xs" onClick={doExportJson} disabled={!data}><Icon name="Download" />JSON</button>
          <button className="btn-ghost !py-1.5 text-xs" onClick={doExportCsv} disabled={!flatRows.length}><Icon name="Download" />CSV</button>
        </div>
      </div>

      {err && <Glass className="p-3 text-xs text-rose-300">Failed to load daily history: {err}</Glass>}
      {!data && !err && <Glass className="p-3 text-xs text-slate-400">Loading daily climate history…</Glass>}

      {data && (
        <>
          {/* Site summary table */}
          <Glass className="overflow-hidden p-0">
            <div className="px-4 py-2.5 text-[11px] text-slate-400">
              {data.sites.length} sites · {data.sites[0].time.length} days each · {data.label}
            </div>
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-white/5 text-left text-slate-400">
                  <tr>
                    <th className="p-2">Site</th>
                    <th>Days</th>
                    <th>temp_max range</th>
                    <th>Total precip</th>
                    <th>Mean soil moisture</th>
                  </tr>
                </thead>
                <tbody>
                  {summaries.map((s) => (
                    <tr key={s.site} className="border-t border-white/5 hover:bg-sky-500/5">
                      <td className="p-2">
                        <div className="font-semibold text-white">{s.site}</div>
                        <div className="text-[10px] text-slate-500">{fmt(s.lat, 2)}°, {fmt(s.lon, 2)}°</div>
                      </td>
                      <td className="p-2 text-slate-200">{s.days}</td>
                      <td className="p-2 whitespace-nowrap text-slate-200">{fmt(s.tMin)}…{fmt(s.tMax)} °C</td>
                      <td className="p-2 whitespace-nowrap text-slate-200">{fmt(s.precip, 0)} mm</td>
                      <td className="p-2 whitespace-nowrap text-slate-200">{fmt(s.soilMean * 100)}% vol</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Glass>

          {/* Earthquake stat */}
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-white/[.03] p-2">
              <div className="text-xs text-slate-400">USGS M5+ total</div>
              <div className="mt-1 text-lg font-bold text-white">{eqTotal.toLocaleString()}</div>
              <div className="text-[10px] text-slate-500">across {eqDays.toLocaleString()} days</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[.03] p-2">
              <div className="text-xs text-slate-400">Mean / day</div>
              <div className="mt-1 text-lg font-bold text-white">{eqDays ? (eqTotal / eqDays).toFixed(1) : '—'}</div>
              <div className="text-[10px] text-slate-500">M5+ earthquakes per day</div>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[.03] p-2">
              <div className="text-xs text-slate-400">Archive window</div>
              <div className="mt-1 text-sm font-bold text-white">{data.time_range.start}</div>
              <div className="text-[10px] text-slate-500">→ {data.time_range.end} · retrieved {data.retrieved_at.slice(0, 10)}</div>
            </div>
          </div>

          {/* Sample preview — most recent 5 rows for the first site */}
          <Glass className="overflow-hidden p-0">
            <div className="px-4 py-2.5">
              <div className="h-title">Sample preview — {first?.site}</div>
              <div className="text-[11px] text-slate-400">5 most recent daily rows</div>
            </div>
            <div className="scroll-thin overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-white/5 text-left text-slate-400">
                  <tr>
                    <th className="p-2">Date</th>
                    <th>temp_max</th>
                    <th>temp_min</th>
                    <th>precip</th>
                    <th>soil</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r) => (
                    <tr key={r.date} className="border-t border-white/5 hover:bg-sky-500/5">
                      <td className="p-2 whitespace-nowrap text-white">{r.date}</td>
                      <td className="p-2 text-slate-200">{r.temp_max == null ? '—' : `${fmt(r.temp_max)} °C`}</td>
                      <td className="p-2 text-slate-200">{r.temp_min == null ? '—' : `${fmt(r.temp_min)} °C`}</td>
                      <td className="p-2 text-slate-200">{r.precip == null ? '—' : `${fmt(r.precip)} mm`}</td>
                      <td className="p-2 text-slate-200">{r.soil == null ? '—' : `${fmt(r.soil * 100)}%`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {data.notes.length > 0 && (
              <div className="border-t border-white/10 px-4 py-2 text-[11px] text-slate-500">{data.notes.join(' ')}</div>
            )}
          </Glass>
        </>
      )}
    </div>
  );
}

export default ClimateExtract;
