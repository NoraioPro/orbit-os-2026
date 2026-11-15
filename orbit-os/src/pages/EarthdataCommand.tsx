import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chip, Glass, Icon, PageHeader, StatusBadge } from '../components/ui';
import { CONNECTORS } from '../data/connectors';
import { DATASETS } from '../data/datasets';
import { fetchJson } from '../data/live';

/**
 * NASA Earthdata command — the integration screen.
 *
 * Counts come from the real ASF harvest on disk, the connector state comes from
 * the dev-server proxy, and the NISAR specification card is mission reference
 * data (published by NASA/ISRO), explicitly not telemetry.
 */

interface Granule {
  granule: string | null;
  platform: string;
  startTime: string | null;
  product: string | null;
  orbit: number | null;
  polarization: string | null;
  fileSizeBytes: number | null;
  browse: string | null;
}
interface SarFile {
  generated_at: string;
  provenance: { provider: string; url: string; access: string; note: string };
  aois: { id: string; name: string; lat: number; lon: number; queries: { platform: string; status: string; count: number }[] }[];
  granules: Granule[];
}
interface ConnectorState { configured: boolean; keyless?: boolean; note: string }

const NISAR_SPEC = [
  ['Agency', 'NASA / ISRO joint mission'],
  ['Orbit', 'Sun-synchronous, ~747 km'],
  ['Repeat cycle', '12 days'],
  ['Radar', 'L-band (24 cm) + S-band (12 cm)'],
  ['Products', 'RSLC · GSLC · GCOV · GOFF'],
];

export default function EarthdataCommand() {
  const [sar, setSar] = useState<SarFile | null>(null);
  const [status, setStatus] = useState<Record<string, ConnectorState> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetchJson('/data/domains/sar.json', 9000)
      .then((s: SarFile) => live && setSar(s))
      .catch((e: Error) => live && setErr(e.message));
    fetch('/api/connector/status')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((s) => live && setStatus(s))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const granules = sar?.granules ?? [];
  const nisar = granules.filter((g) => /NISAR/i.test(g.platform));
  const s1 = granules.filter((g) => /SENTINEL-1/i.test(g.platform));
  const platforms = Array.from(new Set(granules.map((g) => g.platform))).sort();
  const earthdataConfigured = Boolean(status?.earthdata?.configured);

  const flow = useMemo(
    () => [
      {
        id: 'login',
        label: 'Earthdata Login',
        state: earthdataConfigured ? 'verified' : 'missing',
        detail: earthdataConfigured ? 'credentials loaded server-side' : 'no ORBIT_EARTHDATA_USER / PASS — protected downloads stay locked',
      },
      {
        id: 'asf',
        label: 'ASF Search API',
        state: granules.length ? 'verified' : 'missing',
        detail: `${granules.length} granules across ${sar?.aois.length ?? 0} AOIs · keyless`,
      },
      {
        id: 'nisar',
        label: 'NISAR products',
        state: nisar.length ? 'partial' : 'missing',
        detail: nisar.length
          ? `${nisar.length} product records discovered — download needs the login above`
          : 'no NISAR record in this catalog query',
      },
      {
        id: 'analysis',
        label: 'Scientific analysis',
        state: 'partial',
        detail: 'in-app analysis runs on harvested data; InSAR/HyP3 processing is not connected',
      },
    ] as { id: string; label: string; state: 'verified' | 'partial' | 'missing'; detail: string }[],
    [earthdataConfigured, granules.length, nisar.length, sar],
  );

  const chip = (state: 'verified' | 'partial' | 'missing') =>
    state === 'verified'
      ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300'
      : state === 'partial'
        ? 'border-amber-400/40 bg-amber-500/10 text-amber-300'
        : 'border-rose-400/40 bg-rose-500/10 text-rose-300';

  return (
    <div>
      <PageHeader
        icon="Satellite"
        title="NASA Earthdata Command"
        subtitle="Integration status for every authenticated path — what is discovered, what is locked, and what the catalog actually returned."
        right={
          <div className="flex items-center gap-2">
            <StatusBadge status={granules.length ? 'live' : 'snapshot'} note={granules.length ? 'catalog live' : 'no catalog'} />
            <span className={`rounded-lg border px-2 py-1 text-[11px] font-semibold ${chip(earthdataConfigured ? 'verified' : 'missing')}`}>
              Earthdata: {earthdataConfigured ? 'authorized' : 'not authorized'}
            </span>
          </div>
        }
      />

      {err && (
        <Glass className="mb-3 border-amber-400/30 p-3 text-[11px] text-amber-200">
          SAR catalog unavailable ({err}). Run <code className="rounded bg-white/10 px-1">npm run data:domains</code> — nothing is invented in its place.
        </Glass>
      )}

      {/* KPI strip — every number counted from the harvest on disk */}
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-5">
        {[
          { label: 'SAR granule records', value: String(granules.length), note: `${sar?.aois.length ?? 0} AOIs · ASF` },
          { label: 'NISAR products', value: String(nisar.length), note: nisar.length ? 'L-band · GSLC/GCOV/RSLC' : 'none in this query' },
          { label: 'Sentinel-1 products', value: String(s1.length), note: s1.length ? 'C-band' : 'none in this query' },
          { label: 'Platforms discovered', value: String(platforms.length), note: platforms.slice(0, 3).join(' · ') || '—' },
          { label: 'Datasets in registry', value: String(DATASETS.length), note: 'Data Hub' },
        ].map((k) => (
          <Glass key={k.label} className="p-3">
            <div className="text-[9px] uppercase tracking-[0.1em] text-slate-400">{k.label}</div>
            <div className="mt-1 text-[22px] font-bold leading-none text-white">{k.value}</div>
            <div className="mt-1 text-[10px] text-slate-400">{k.note}</div>
          </Glass>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,1fr)]">
        {/* connection flow */}
        <Glass className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Connection flow</span>
            <span className="text-[9px] text-slate-500">Earthdata → ASF → NISAR → analysis</span>
          </div>
          <ol className="grid gap-2 sm:grid-cols-4">
            {flow.map((step, i) => (
              <li key={step.id} className="relative rounded-xl border border-white/10 bg-slate-950/40 p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-slate-300">{i + 1}</span>
                  <span className={`rounded border px-1.5 py-[1px] text-[9px] font-semibold uppercase ${chip(step.state)}`}>{step.state}</span>
                </div>
                <div className="mt-1 text-[12px] font-medium text-white">{step.label}</div>
                <div className="mt-0.5 text-[10px] leading-snug text-slate-400">{step.detail}</div>
              </li>
            ))}
          </ol>
          <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/40 p-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wide text-slate-400">Catalog by AOI</span>
              {sar && <span className="text-[9px] text-slate-500">harvested {new Date(sar.generated_at).toLocaleString('en-GB', { hour12: false })}</span>}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {(sar?.aois ?? []).map((a) => (
                <div key={a.id} className="rounded-lg border border-white/5 bg-white/[0.02] p-2">
                  <div className="text-[11px] font-medium text-white">{a.name}</div>
                  <div className="text-[9px] text-slate-500">{a.lat}°, {a.lon}°</div>
                  <ul className="mt-1 space-y-0.5">
                    {a.queries.map((q) => (
                      <li key={q.platform} className="flex items-center justify-between gap-1 text-[10px]">
                        <span className="truncate text-slate-300">{q.platform}</span>
                        <span className={q.count > 0 ? 'text-emerald-300' : 'text-amber-300'}>
                          {q.count > 0 ? `${q.count} granules` : 'no granule'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-slate-500">
              A query that returned nothing is shown as nothing — e.g. NISAR has no record over Svalbard in this catalog, so the board must not claim one.
            </p>
          </div>
        </Glass>

        <div className="flex flex-col gap-3">
          <Glass className="p-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">NISAR · mission reference</span>
              <span className="text-[9px] text-slate-500">not telemetry</span>
            </div>
            <ul className="space-y-1">
              {NISAR_SPEC.map(([k, v]) => (
                <li key={k} className="flex items-baseline justify-between gap-2 text-[11px]">
                  <span className="text-slate-500">{k}</span>
                  <span className="text-right text-slate-200">{v}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10px] leading-snug text-slate-500">
              Published mission parameters from NASA/ISRO. This build receives no NISAR telemetry, so no orbit or status readout is presented as live.
            </p>
          </Glass>

          <Glass className="p-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Source access</span>
              <span className="text-[9px] text-slate-500">{CONNECTORS.filter((c) => c.status === 'connected').length}/{CONNECTORS.length} keyless</span>
            </div>
            <ul className="space-y-1">
              {CONNECTORS.slice(0, 8).map((c) => {
                const on = c.status === 'connected';
                return (
                  <li key={c.id} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="truncate text-slate-200">{c.name}</span>
                    <span className={`shrink-0 text-[9px] font-semibold uppercase ${on ? 'text-emerald-300' : 'text-slate-500'}`}>{on ? 'online' : 'locked'}</span>
                  </li>
                );
              })}
            </ul>
          </Glass>
        </div>
      </div>

      <Glass className="mt-3 p-3">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Real catalog records</span>
          <span className="text-[9px] text-slate-500">{platforms.join(' · ') || '—'}</span>
        </div>
        <ul className="grid gap-1.5 md:grid-cols-2">
          {granules.slice(0, 6).map((g) => (
            <li key={`${g.granule}-${g.product}`} className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1.5">
              <span className="grid h-9 w-11 shrink-0 place-items-center overflow-hidden rounded border border-white/10 bg-slate-900">
                {g.browse ? (
                  <img src={g.browse} alt={`${g.platform} browse`} className="h-full w-full object-cover" loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <Icon name="Satellite" className="h-4 w-4 text-slate-600" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-medium text-white">{g.platform} <span className="text-slate-400">{g.product ?? ''}</span></div>
                <div className="truncate text-[10px] text-slate-400">{g.startTime?.replace('T', ' ').slice(0, 19)} UTC · orbit {g.orbit ?? '—'}{g.polarization ? ` · ${g.polarization}` : ''}</div>
              </div>
              <span className="shrink-0 rounded border border-emerald-400/30 bg-emerald-500/10 px-1.5 py-[1px] text-[9px] font-semibold uppercase text-emerald-300">real</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Chip><Icon name="ShieldCheck" className="h-3 w-3" />metadata verified by ASF</Chip>
          <Link to="/verify" className="btn-ghost !px-2.5 !py-1 text-[11px]">Readiness checklist →</Link>
          <Link to="/earthdata" className="btn-ghost !px-2.5 !py-1 text-[11px]">Earthdata access path →</Link>
          <Link to="/module/sar" className="btn-ghost !px-2.5 !py-1 text-[11px]">SAR observatory →</Link>
          <span className="ml-auto text-[10px] text-slate-500">Product download and HyP3 processing stay locked until an Earthdata login is supplied.</span>
        </div>
      </Glass>
    </div>
  );
}
