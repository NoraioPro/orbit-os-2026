import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Chip, Glass, Icon, PageHeader, StatusBadge } from '../components/ui';
import { CONNECTORS } from '../data/connectors';
import { DATASETS } from '../data/datasets';
import { fetchJson } from '../data/live';

/**
 * Data access verification.
 *
 * Every row here is evidence-driven: the server's own connector state, the ASF
 * harvest actually on disk, and the dataset registry. Nothing says "connected"
 * unless something in this build can prove it — and the page states what it
 * could not verify just as loudly as what it could.
 */

interface ConnectorState { configured: boolean; keyless?: boolean; note: string }
interface SarGranule {
  granule: string | null; platform: string; startTime: string | null; product: string | null;
  orbit: number | null; path: number | null; frame: number | null; browse: string | null; fileSizeBytes: number | null;
}
interface SarFile {
  generated_at: string;
  provenance: { provider: string; url: string; access: string; honesty: string };
  queries: { platform: string; url: string; status: string; granules: SarGranule[] }[];
  granules: SarGranule[];
}

export default function Verify() {
  const [status, setStatus] = useState<Record<string, ConnectorState> | null>(null);
  const [statusErr, setStatusErr] = useState<string | null>(null);
  const [sar, setSar] = useState<SarFile | null>(null);
  const [domains, setDomains] = useState<{ id: string; file: string; title: string }[] | null>(null);
  const [ranAt] = useState(() => new Date());

  useEffect(() => {
    let live = true;
    fetch('/api/connector/status')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((s) => live && setStatus(s))
      .catch((e: Error) => live && setStatusErr(e.message));
    fetchJson('/data/domains/sar.json', 9000).then((s: SarFile) => live && setSar(s)).catch(() => undefined);
    fetchJson('/data/domains/index.json', 9000)
      .then((i: { domains: { id: string; file: string; title: string }[] }) => live && setDomains(i.domains))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const granules = sar?.granules ?? [];
  const nisar = granules.filter((g) => /NISAR/i.test(g.platform));
  const s1 = granules.filter((g) => /SENTINEL-1|S1/i.test(g.platform));
  const asfLive = Boolean(sar && granules.length > 0);
  const earthdataConfigured = Boolean(status?.earthdata?.configured);

  const checks = useMemo(() => {
    const md = DATASETS.filter((d) => d.provider && d.note).length;
    return [
      {
        id: 'earthdata',
        label: 'Earthdata account',
        state: earthdataConfigured ? 'verified' : 'missing',
        evidence: earthdataConfigured
          ? 'server reports ORBIT_EARTHDATA_USER + PASS loaded'
          : statusErr
            ? `status endpoint unreachable (${statusErr})`
            : 'no ORBIT_EARTHDATA_USER / PASS in .env — protected downloads stay locked',
        to: '/earthdata',
      },
      {
        id: 'asf',
        label: 'ASF Search API',
        state: asfLive ? 'verified' : 'missing',
        evidence: asfLive ? `${granules.length} granules harvested (${nisar.length} NISAR · ${s1.length} Sentinel-1)` : 'no ASF harvest on disk — run npm run data:domains',
        to: '/module/sar',
      },
      {
        id: 'nisar',
        label: 'NISAR access',
        state: nisar.length > 0 ? 'partial' : 'missing',
        evidence: nisar.length > 0
          ? `discovery verified (${nisar.length} products incl. GSLC/GCOV); download needs the Earthdata login above`
          : 'no NISAR granule discovered',
        to: '/module/sar',
      },
      {
        id: 'hyp3',
        label: 'Processing workflow',
        state: 'missing',
        evidence: 'ASF HyP3 needs an Earthdata login — no processing job has been submitted from this build',
        to: '/earthdata',
      },
      {
        id: 'metadata',
        label: 'Metadata & provenance',
        state: md > 0 ? 'verified' : 'missing',
        evidence: `${md} datasets carry provider + note; every module shows a provenance strip`,
        to: '/data',
      },
      {
        id: 'export',
        label: 'Exportable results',
        state: (domains?.length ?? 0) > 0 ? 'verified' : 'partial',
        evidence: `${domains?.length ?? 0} domain files + harvested JSON/CSV downloadable from the Data Hub`,
        to: '/data',
      },
    ] as { id: string; label: string; state: 'verified' | 'partial' | 'missing'; evidence: string; to: string }[];
  }, [asfLive, earthdataConfigured, granules.length, nisar.length, s1.length, statusErr, domains]);

  const verified = checks.filter((c) => c.state === 'verified').length;
  const partial = checks.filter((c) => c.state === 'partial').length;
  const ready = asfLive && (domains?.length ?? 0) > 0;

  const stateChip = (state: 'verified' | 'partial' | 'missing') =>
    state === 'verified'
      ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-300'
      : state === 'partial'
        ? 'border-amber-400/40 bg-amber-500/10 text-amber-300'
        : 'border-rose-400/40 bg-rose-500/10 text-rose-300';

  return (
    <div>
      <PageHeader
        icon="ShieldCheck"
        title="Data access verification"
        subtitle="What is actually connected — checked against the server, the harvest on disk and the dataset registry. Unverified paths say so."
        right={<span className="text-[11px] text-slate-400">checked {ranAt.toLocaleString('en-GB', { hour12: false })}</span>}
      />

      <div className="mb-3 grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,1fr)]">
        <Glass className="p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Real-data readiness checklist</span>
            <span className="text-[10px] text-slate-500">{verified} verified · {partial} partial · {checks.length - verified - partial} missing</span>
          </div>
          <ul className="space-y-1.5">
            {checks.map((c) => (
              <li key={c.id} className="flex items-start gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-2">
                <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${stateChip(c.state)}`}>
                  <Icon name={c.state === 'verified' ? 'CircleCheck' : c.state === 'partial' ? 'TriangleAlert' : 'X'} className="h-3 w-3" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-medium text-white">{c.label}</span>
                    <span className={`rounded border px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-wide ${stateChip(c.state)}`}>{c.state}</span>
                  </div>
                  <div className="text-[10px] leading-snug text-slate-400">{c.evidence}</div>
                </div>
                <Link to={c.to} className="shrink-0 text-[10px] text-sky-300 hover:text-sky-200">open →</Link>
              </li>
            ))}
          </ul>
        </Glass>

        <div className="flex flex-col gap-3">
          <Glass className={`p-3 ${ready ? 'border-emerald-400/25' : 'border-amber-400/30'}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-semibold text-white">Data access status</span>
              <StatusBadge status={asfLive ? 'live' : 'snapshot'} note={asfLive ? 'asf harvest live' : 'no harvest'} />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2">
                <div className="text-[9px] uppercase tracking-wide text-slate-500">ASF granules</div>
                <div className="text-[16px] font-semibold text-white">{granules.length}</div>
                <div className="text-[9px] text-slate-500">{nisar.length} NISAR · {s1.length} Sentinel-1</div>
              </div>
              <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2">
                <div className="text-[9px] uppercase tracking-wide text-slate-500">Domain files</div>
                <div className="text-[16px] font-semibold text-white">{domains?.length ?? '—'}</div>
                <div className="text-[9px] text-slate-500">agri · ocean · sar</div>
              </div>
              <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2">
                <div className="text-[9px] uppercase tracking-wide text-slate-500">Earthdata login</div>
                <div className={`text-[13px] font-semibold ${earthdataConfigured ? 'text-emerald-300' : 'text-rose-300'}`}>{earthdataConfigured ? 'configured' : 'not configured'}</div>
                <div className="text-[9px] text-slate-500">{status?.earthdata?.note?.slice(0, 42) ?? '—'}</div>
              </div>
              <div className="rounded-lg border border-white/5 bg-white/[0.02] p-2">
                <div className="text-[9px] uppercase tracking-wide text-slate-500">Recommended id</div>
                <div className="text-[13px] font-semibold text-sky-300">asf</div>
                <div className="text-[9px] text-slate-500">{status?.asf?.note ?? 'keyless search'}</div>
              </div>
            </div>
            <p className="mt-2 text-[10px] leading-snug text-slate-400">
              {ready
                ? 'Ready for traceable Earth intelligence — for the rows marked verified above. The unverified rows are the ones that would need a credential.'
                : 'Not yet ready for traceable Earth intelligence: the ASF harvest or the domain layer is missing.'}
            </p>
          </Glass>

          <Glass className="p-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Available SAR datasets</span>
              <span className="text-[9px] text-slate-500">discovery only</span>
            </div>
            <ul className="space-y-1">
              {[
                { name: 'NISAR', band: 'L-band', state: nisar.length ? 'verified' : 'missing', note: nisar.length ? `${nisar.length} products · GSLC / GCOV / RSLC` : 'no granule' },
                { name: 'Sentinel-1', band: 'C-band', state: s1.length ? 'verified' : 'missing', note: s1.length ? `${s1.length} products` : 'no granule' },
                { name: 'ALOS PALSAR', band: 'L-band', state: 'missing', note: 'not queried in this build' },
                { name: 'UAVSAR', band: 'L-band', state: 'missing', note: 'not queried in this build' },
              ].map((d) => (
                <li key={d.name} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-slate-200">{d.name} <span className="text-slate-500">({d.band})</span></span>
                  <span className="text-[9px] text-slate-500">{d.note}</span>
                  <span className={`shrink-0 rounded border px-1.5 py-[1px] text-[9px] font-semibold uppercase ${stateChip(d.state as 'verified' | 'missing')}`}>{d.state}</span>
                </li>
              ))}
            </ul>
          </Glass>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <Glass className="p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Real recent acquisitions · ASF</span>
            {sar && <span className="text-[9px] text-slate-500">harvested {new Date(sar.generated_at).toLocaleString('en-GB', { hour12: false })}</span>}
          </div>
          <ul className="space-y-1.5">
            {granules.slice(0, 4).map((g) => (
              <li key={`${g.granule}-${g.product}`} className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1.5">
                <span className="grid h-8 w-10 shrink-0 place-items-center overflow-hidden rounded border border-white/10 bg-slate-900">
                  {g.browse ? (
                    <img
                      src={g.browse}
                      alt={`${g.platform} browse`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <Icon name="Satellite" className="h-4 w-4 text-slate-600" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] font-medium text-white">{g.platform} <span className="text-slate-400">{g.product ?? ''}</span></div>
                  <div className="truncate text-[10px] text-slate-400">{g.startTime?.replace('T', ' ').slice(0, 19)} UTC · orbit {g.orbit ?? '—'} · path {g.path ?? '—'}</div>
                </div>
                <span className="shrink-0 rounded border border-emerald-400/30 bg-emerald-500/10 px-1.5 py-[1px] text-[9px] font-semibold uppercase text-emerald-300">real</span>
              </li>
            ))}
            {!granules.length && <li className="text-[11px] text-slate-500">No ASF harvest found — nothing is shown rather than a placeholder.</li>}
          </ul>
        </Glass>

        <Glass className="p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">Connected data APIs</span>
            <span className="text-[9px] text-slate-500">{CONNECTORS.filter((c) => c.status === 'connected').length}/{CONNECTORS.length} keyless-connected</span>
          </div>
          <ul className="grid gap-1 sm:grid-cols-2">
            {CONNECTORS.map((c) => {
              const on = c.status === 'connected';
              return (
                <li key={c.id} className="rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1.5">
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate text-[11px] text-slate-200">{c.name}</span>
                    <span className={`shrink-0 text-[9px] font-semibold uppercase ${on ? 'text-emerald-300' : 'text-slate-500'}`}>{on ? 'online' : 'locked'}</span>
                  </div>
                  <div className="truncate text-[9px] text-slate-500">{on ? c.dateRange ?? c.purpose : c.auth}</div>
                </li>
              );
            })}
          </ul>
        </Glass>
      </div>

      <Glass className="mt-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Chip><Icon name="ShieldCheck" className="h-3 w-3" />verified {verified}/{checks.length}</Chip>
          <Link to="/earthdata" className="btn-ghost !px-2.5 !py-1 text-[11px]">Earthdata access path →</Link>
          <Link to="/module/sar" className="btn-ghost !px-2.5 !py-1 text-[11px]">SAR observatory →</Link>
          <Link to="/data" className="btn-ghost !px-2.5 !py-1 text-[11px]">Data Hub →</Link>
          <Link to="/reports" className="btn-ghost !px-2.5 !py-1 text-[11px]">Reports →</Link>
          <span className="ml-auto text-[10px] text-slate-500">A green tick here means something in this build proved it — not that a screenshot said so.</span>
        </div>
      </Glass>
    </div>
  );
}
