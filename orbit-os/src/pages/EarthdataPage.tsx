import { Link } from 'react-router-dom';
import { Glass, Icon, StatusBadge } from '../components/ui';
import { Provenance } from '../components/Provenance';
import { WorkflowStrip } from '../components/WorkflowStrip';

const API_STATUS = [
  { name: 'ASF Search API', status: 'keyless', note: 'scene metadata' },
  { name: 'Earthaccess (NISAR)', status: 'login', note: 'Earthdata login' },
  { name: 'NISAR Archive', status: 'login', note: 'Earthdata login' },
  { name: 'Copernicus STAC', status: 'login', note: 'CDSE credentials' },
  { name: 'Sentinel Hub', status: 'login', note: 'a token' },
] as const;

const COLLECTIONS = [
  { name: 'NISAR', type: 'L-band SAR' },
  { name: 'Sentinel-1', type: 'C-band SAR' },
  { name: 'MODIS', type: 'Optical' },
  { name: 'Landsat', type: 'Optical' },
  { name: 'GPM', type: 'Precipitation' },
  { name: 'SWOT', type: 'Altimetry' },
  { name: 'PACE', type: 'Ocean colour' },
];

const PIPELINE = ['Discover', 'Authenticate', 'Process', 'Validate'];

export default function EarthdataPage() {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-lg font-bold text-white">
            <Icon name="Earth" className="h-5 w-5 text-sky-300" /> NASA Earthdata
          </div>
          <p className="text-xs text-slate-400">From Earthdata to evidence — authenticate once, then every download is traceable.</p>
        </div>
        <StatusBadge status="sample" note="demo mode — sign in for real NISAR / Sentinel-1" />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Glass className="p-4">
          <div className="h-title">Earthdata connection</div>
          <div className="mt-2 flex items-center gap-2">
            <span className="rounded border border-amber-400/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">Not authenticated</span>
            <span className="text-xs text-slate-400">No Earthdata login on this device</span>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            One free Earthdata login (URS) unlocks <b className="text-slate-200">Earthdata, ASF granule download, NISAR earthaccess and HyP3</b> — 4 of the 8 credential gaps.
          </p>
          <a href="https://urs.earthdata.nasa.gov/users/new" target="_blank" rel="noreferrer" className="btn-primary mt-3 inline-flex items-center gap-1.5 text-xs">
            Create free Earthdata login ↗
          </a>
          <div className="mt-3 border-t border-white/10 pt-2">
            <div className="text-[10px] uppercase tracking-wide text-slate-400">API status</div>
            <div className="mt-1 space-y-1">
              {API_STATUS.map((a) => (
                <div key={a.name} className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-200">{a.name}</span>
                  <span className={a.status === 'keyless' ? 'text-emerald-300' : 'text-amber-300'}>
                    {a.status === 'keyless' ? '● online (keyless)' : `● needs ${a.note}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Glass>

        <Glass className="p-4">
          <div className="h-title">ORBIT data pipeline</div>
          <div className="mt-3 space-y-2">
            {PIPELINE.map((s, i) => (
              <div key={s} className="flex items-center gap-2 text-xs">
                <span className={`grid h-6 w-6 place-items-center rounded-full border ${i === 0 ? 'border-sky-400/50 bg-sky-500/20 text-sky-200' : 'border-white/10 bg-white/5 text-slate-500'}`}>{i + 1}</span>
                <span className={i === 0 ? 'text-slate-100' : 'text-slate-500'}>{s}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-400">Authenticate once; every scene, download and product keeps its source + acquisition time.</p>
          <WorkflowStrip active={0} className="mt-3" />
        </Glass>
      </div>

      <Glass className="p-4">
        <div className="h-title">Collections</div>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {COLLECTIONS.map((c) => (
            <div key={c.name} className="rounded-lg border border-white/10 bg-white/5 p-2 text-[11px]">
              <div className="font-semibold text-slate-100">{c.name}</div>
              <div className="text-slate-500">{c.type}</div>
              <div className="mt-1 text-amber-300/80">● planned · needs Earthdata</div>
            </div>
          ))}
        </div>
      </Glass>

      <Glass className="p-4">
        <div className="h-title">One real, traceable NISAR result — the target</div>
        <p className="mt-1 text-xs text-slate-400">
          The outcome the pipeline is built to produce: a NISAR L-band change product with its acquisition time, orbit, polarisation, resolution and uncertainty — all traceable. Until an Earthdata login is supplied, ORBIT shows the SAR modules as <b className="text-amber-300">SAMPLE</b> and never invents a scene.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4">
          {[['Sensor', 'NISAR L-band dual-pol'], ['Acquisition', '2026-11-12 00:03:42'], ['Orbit', 'A152 / Ascending'], ['Resolution', '~10 m']].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-white/10 bg-white/5 p-2">
              <div className="text-[9px] uppercase tracking-wide text-slate-500">{k}</div>
              <div className="text-slate-200">{v}</div>
            </div>
          ))}
        </div>
        <div className="mt-2 rounded-lg border border-amber-400/30 bg-amber-500/10 p-2 text-[11px] text-amber-200">
          ⚠ Illustrative target — values shown are the demo template, not a live NISAR scene.
        </div>
      </Glass>

      <Provenance
        sources={[
          { name: 'NASA Earthdata', url: 'https://urs.earthdata.nasa.gov/' },
          { name: 'ASF DAAC', url: 'https://asf.alaska.edu/' },
          { name: 'Copernicus', url: 'https://dataspace.copernicus.eu/' },
        ]}
        coverage={{ start: '2001', end: '14 Nov 2026', label: 'varies by collection' }}
        honesty="sample"
        citation="NASA Earthdata / ASF / ESA Copernicus"
      />

      <div className="text-xs text-slate-500">
        See <Link to="/settings" className="text-sky-300 hover:underline">Settings → Data connections</Link> for the full status of every source.
      </div>
    </div>
  );
}
