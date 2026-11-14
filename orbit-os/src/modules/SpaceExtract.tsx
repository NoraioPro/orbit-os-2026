import { useEffect, useState } from 'react';
import { Chip, Glass, Icon, StatusBadge } from '../components/ui';
import { downloadCsv, downloadJson } from '../data/export';

/**
 * Space Extract — a compact data-hub extractor for the live ORBIT harvests:
 * CelesTrak satellite catalogue sample + NOAA SWPC space weather + NASA DONKI CMEs.
 * Fetches at runtime from /data/live; exports the raw JSON plus a flattened CSV.
 */

interface SatSample {
  name: string;
  norad: number;
  epoch: string;
  mean_motion: number;
  eccentricity: number;
  inclination: number;
  raan: number;
  arg_perigee: number;
  mean_anomaly: number;
}

interface SatellitesFile {
  catalog_count: number;
  sample: SatSample[];
}

interface Cme {
  id: string;
  time: string;
  speed: number | null;
  half_angle: number | null;
  type: string | null;
  url: string;
  note: string;
}

interface SpaceFile {
  swpc: {
    kp_latest_est: [string, number] | null;
    kp3h: [string, number][];
    wind: [string, number | null, number | null][];
    imf: [string, number | null, number | null][];
  };
  donki: {
    cmes: Cme[];
  };
}

const SAT_COLUMNS = ['name', 'norad', 'inclination', 'eccentricity', 'mean_motion'];

const fmtTime = (t: string) => {
  const d = new Date(t);
  return isNaN(d.getTime()) ? t : d.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
};

const Stat = ({ label, value, color = '#e2e8f0' }: { label: string; value: string; color?: string }) => (
  <div className="rounded-lg border border-white/10 bg-white/[.03] p-2">
    <div className="text-lg font-bold" style={{ color }}>{value}</div>
    <div className="text-[10px] text-slate-500">{label}</div>
  </div>
);

export function SpaceExtract() {
  const [sats, setSats] = useState<SatellitesFile | null>(null);
  const [space, setSpace] = useState<SpaceFile | null>(null);
  const [satErr, setSatErr] = useState<string | null>(null);
  const [spaceErr, setSpaceErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/data/live/satellites.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j: SatellitesFile) => { if (alive) { setSats(j); setSatErr(null); } })
      .catch((e) => { if (alive) setSatErr(`satellites.json unavailable (${String(e).replace(/^Error: /, '')})`); });
    fetch('/data/live/space.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j: SpaceFile) => { if (alive) { setSpace(j); setSpaceErr(null); } })
      .catch((e) => { if (alive) setSpaceErr(`space.json unavailable (${String(e).replace(/^Error: /, '')})`); });
    return () => { alive = false; };
  }, []);

  const sample = sats?.sample ?? [];
  const cmes = space?.donki?.cmes ?? [];
  const kp = space?.swpc?.kp_latest_est?.[1] ?? null;

  return (
    <div className="space-y-3">
      {/* ---- Header ---- */}
      <Glass className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-sky-300/20 bg-sky-500/10 p-2"><Icon name="Satellite" className="h-6 w-6 text-sky-300" /></div>
            <div>
              <div className="flex items-center gap-2"><h1 className="text-xl font-bold text-white">Satellites &amp; space weather</h1><StatusBadge status="live" note="CelesTrak + NOAA SWPC + NASA DONKI" /></div>
              <p className="text-xs text-slate-400">Live orbital catalogue and space-weather extracts, exportable for the Data Hub.</p>
            </div>
          </div>
        </div>
      </Glass>

      {/* ---- Stat row ---- */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="CelesTrak catalog" value={sats ? sats.catalog_count.toLocaleString('en-US') : '—'} />
        <Stat label="Sample size" value={sats ? sample.length.toLocaleString('en-US') : '—'} />
        <Stat label="Latest Kp (est.)" value={kp != null ? kp.toFixed(1) : '—'} color={kp != null && kp >= 5 ? '#f43f5e' : '#34d399'} />
        <Stat label="DONKI CMEs" value={space ? cmes.length.toLocaleString('en-US') : '—'} />
      </div>

      {(satErr || spaceErr) && (
        <p className="text-xs text-slate-400">{satErr}{satErr && spaceErr ? ' · ' : ''}{spaceErr}</p>
      )}

      {/* ---- Satellite sample table ---- */}
      <Glass className="p-4">
        <div className="flex items-center justify-between">
          <div className="h-title">Satellite sample preview</div>
          {sats && <Chip>{sample.length} of {sats.catalog_count.toLocaleString('en-US')}</Chip>}
        </div>
        <div className="scroll-thin mt-2 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-xs">
            <thead className="bg-slate-900 text-left text-slate-400">
              <tr><th className="p-2">Name</th><th className="p-2">NORAD</th><th className="p-2">Inclination</th><th className="p-2">Eccentricity</th><th className="p-2">Mean motion</th></tr>
            </thead>
            <tbody>
              {sample.slice(0, 10).map((s) => (
                <tr key={s.norad} className="border-t border-white/5">
                  <td className="p-2 text-slate-200">{s.name}</td>
                  <td className="p-2 font-mono text-slate-400">{s.norad}</td>
                  <td className="p-2 font-mono text-slate-300">{s.inclination.toFixed(2)}°</td>
                  <td className="p-2 font-mono text-slate-300">{s.eccentricity.toFixed(5)}</td>
                  <td className="p-2 font-mono text-slate-300">{s.mean_motion.toFixed(4)}</td>
                </tr>
              ))}
              {!sample.length && <tr><td colSpan={5} className="p-3 text-slate-500">{satErr ? 'Satellite data unavailable.' : 'Loading…'}</td></tr>}
            </tbody>
          </table>
        </div>
      </Glass>

      {/* ---- CME sample table ---- */}
      <Glass className="p-4">
        <div className="flex items-center justify-between">
          <div className="h-title">Recent coronal mass ejections</div>
          {space && <Chip>{cmes.length} total</Chip>}
        </div>
        <div className="scroll-thin mt-2 overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-xs">
            <thead className="bg-slate-900 text-left text-slate-400">
              <tr><th className="p-2">Time</th><th className="p-2">Speed</th><th className="p-2">Type</th></tr>
            </thead>
            <tbody>
              {cmes.slice(0, 5).map((c) => (
                <tr key={c.id} className="border-t border-white/5">
                  <td className="p-2 font-mono text-slate-300">{fmtTime(c.time)}</td>
                  <td className="p-2 font-mono text-slate-300">{c.speed != null ? `${c.speed.toLocaleString('en-US')} km/s` : '—'}</td>
                  <td className="p-2 text-slate-300">{c.type ?? '—'}</td>
                </tr>
              ))}
              {!cmes.length && <tr><td colSpan={3} className="p-3 text-slate-500">{spaceErr ? 'Space-weather data unavailable.' : 'Loading…'}</td></tr>}
            </tbody>
          </table>
        </div>
      </Glass>

      {/* ---- Export ---- */}
      <Glass className="p-4">
        <div className="flex items-center gap-2">
          <Icon name="Download" className="h-4 w-4 text-slate-500" />
          <div className="h-title">Export</div>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button className="btn-ghost !px-2 !py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40" disabled={!sats} onClick={() => sats && downloadJson('satellites.json', sats)}>
            <Icon name="Download" className="h-3.5 w-3.5" />satellites.json
          </button>
          <button className="btn-ghost !px-2 !py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40" disabled={!space} onClick={() => space && downloadJson('space.json', space)}>
            <Icon name="Download" className="h-3.5 w-3.5" />space.json
          </button>
          <button className="btn-ghost !px-2 !py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40" disabled={!sats} onClick={() => sats && downloadCsv('satellites.csv', sats.sample.map((s) => ({ name: s.name, norad: s.norad, inclination: s.inclination, eccentricity: s.eccentricity, mean_motion: s.mean_motion })), SAT_COLUMNS)}>
            <Icon name="Download" className="h-3.5 w-3.5" />satellites.csv
          </button>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">JSON exports carry the full fetched payload; the CSV flattens the satellite sample to {SAT_COLUMNS.join(', ')}.</p>
      </Glass>
    </div>
  );
}

export default SpaceExtract;
