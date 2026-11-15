import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { fetchJson } from '../data/live';
import { Chip, Glass, Icon, StatusBadge } from '../components/ui';
import { Provenance } from '../components/Provenance';
import {
  CENTER_TABS,
  DATA_COLLECTIONS,
  GIBS_DATE,
  NOT_CONNECTED,
  NOT_CONNECTED_FOOTNOTE,
  OCEAN_DATA_URL,
  TAB_NOT_CONNECTED,
  asOceanDomain,
  aoiBBox,
  coordLabel,
  coverageCells,
  fmt,
  gibsUrl,
  seriesById,
  sstLayer,
  type CenterTab,
  type DataCollection,
  type DisconnectedTile,
  type OceanDomain,
  type OceanSeries,
} from '../data/oceanBoard';

const ACCENT = 'text-cyan-300';
const RING = 'border-cyan-400/25';

/* ------------------------------------------------------------------ atoms */

function Panel({ title, hint, right, children }: { title: string; hint?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <Glass className={`border ${RING} p-3`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-[12px] font-semibold uppercase tracking-[0.1em] text-slate-200">{title}</h3>
          {hint && <p className="truncate text-[10px] text-slate-500">{hint}</p>}
        </div>
        {right}
      </div>
      {children}
    </Glass>
  );
}

function LiveTile({ label, value, unit, note }: { label: string; value: string; unit: string; note: string }) {
  return (
    <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/[0.06] p-2.5">
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-[10px] uppercase tracking-[0.08em] text-slate-300">{label}</span>
        <span className="shrink-0 text-[9px] font-semibold uppercase text-emerald-300">live</span>
      </div>
      <div className={`mt-1 text-[20px] font-semibold leading-none ${ACCENT}`}>
        {value}
        <span className="ml-1 text-[10px] font-normal text-slate-400">{unit}</span>
      </div>
      <p className="mt-1 text-[10px] leading-snug text-slate-400">{note}</p>
    </div>
  );
}

function GapTile({ tile, compact = false }: { tile: DisconnectedTile; compact?: boolean }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-400/25 bg-slate-500/[0.06] p-2.5">
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-[10px] uppercase tracking-[0.08em] text-slate-300">{tile.label}</span>
        <span className="shrink-0 text-[9px] font-semibold uppercase text-slate-500">not connected</span>
      </div>
      <div className="mt-1 text-[20px] font-semibold leading-none text-slate-500">
        —<span className="ml-1 text-[10px] font-normal text-slate-600">{tile.unit}</span>
      </div>
      <p className={`mt-1 text-[10px] leading-snug text-slate-500 ${compact ? 'line-clamp-2' : ''}`}>{tile.reason}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ chart */

function OceanSeriesChart({ a, b, height = 120 }: { a?: OceanSeries; b?: OceanSeries; height?: number }) {
  const W = 320;
  const H = height;
  const build = (s?: OceanSeries) => {
    const values = s?.values ?? [];
    const nums = values.filter((v): v is number => typeof v === 'number');
    if (!nums.length) return { path: '', dots: [] as [number, number][] };
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const span = max - min || 1;
    const stepPct = 100 / Math.max(1, values.length - 1);
    const dots: [number, number][] = [];
    values.forEach((v, i) => {
      if (typeof v !== 'number') return;
      dots.push([i * stepPct, H - 10 - ((v - min) / span) * (H - 26)]);
    });
    return {
      path: dots.map(([x, y], i) => `${i ? 'L' : 'M'}${((x / 100) * (W - 8) + 4).toFixed(1)},${y.toFixed(1)}`).join(' '),
      dots,
    };
  };
  const A = build(a);
  const B = build(b);
  const months = a?.months ?? b?.months ?? [];
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${a?.label ?? 'series'} and ${b?.label ?? 'series'} monthly values, ${a?.unit ?? ''}`}>
        <line x1="0" y1={H - 10} x2={W} y2={H - 10} stroke="rgba(148,163,184,.25)" strokeWidth="1" />
        {[0, 1, 2, 3].map((i) => (
          <line key={i} x1="0" y1={10 + i * ((H - 20) / 3)} x2={W} y2={10 + i * ((H - 20) / 3)} stroke="rgba(148,163,184,.08)" strokeWidth="1" />
        ))}
        {B.path && <path d={B.path} fill="none" stroke="#eab308" strokeWidth="1.6" strokeDasharray="4 3" />}
        {A.path && <path d={A.path} fill="none" stroke="#22d3ee" strokeWidth="2" />}
        {A.dots.map(([x, y], i) => (
          <circle key={`a${i}`} cx={(x / 100) * (W - 8) + 4} cy={y} r="2.4" fill="#22d3ee" />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[9px] text-slate-500">
        {months.map((m, i) => (
          <span key={`${m}${i}`}>{m}</span>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- subviews */

function MapCard({ d, layer, src }: { d: OceanDomain; layer: string; src: string | null }) {
  const [failed, setFailed] = useState(false);
  const broken = failed || !src;
  return (
    <Glass className={`flex min-h-[340px] flex-col border ${RING} bg-gradient-to-b from-cyan-500/[0.08] to-transparent p-3 sm:min-h-[440px]`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-[13px] font-semibold text-white">Sea surface temperature</h3>
          <p className="truncate text-[10px] text-slate-400">GHRSST MUR L4 · NASA GIBS WMS · TIME {GIBS_DATE}</p>
        </div>
        <Chip className="shrink-0">
          <Icon name="Target" className="h-3 w-3" /> {coordLabel(d.aoi.lat, d.aoi.lon)}
        </Chip>
      </div>

      <div className="relative mt-2 min-h-[210px] flex-1 overflow-hidden rounded-xl border border-white/10 bg-slate-950/70">
        {broken ? (
          <div className="grid h-full min-h-[210px] place-items-center p-4 text-center">
            <div>
              <Icon name="TriangleAlert" className="mx-auto h-5 w-5 text-amber-300" />
              <p className="mt-1.5 text-[11px] font-semibold text-amber-200">imagery unavailable</p>
              <p className="mt-1 text-[10px] leading-snug text-slate-400">
                GIBS did not return a GetMap for this window. No substitute raster is drawn.
              </p>
              <p className="mt-1 truncate text-[9px] text-slate-500" title={layer}>
                layer {layer}
              </p>
            </div>
          </div>
        ) : (
          <img
            src={src}
            alt={`Sea surface temperature for ${d.aoi.name} — NASA GIBS GHRSST MUR L4`}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            onError={() => setFailed(true)}
          />
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent px-2.5 pb-2 pt-8">
          <div className="truncate text-[11px] font-semibold text-white">{d.aoi.name}</div>
          <div className="truncate text-[9px] text-slate-400">
            AOI window {coordLabel(d.aoi.lat - 6, d.aoi.lon - 10)} → {coordLabel(d.aoi.lat + 6, d.aoi.lon + 10)}
          </div>
        </div>
      </div>

      <div className="mt-2">
        <div
          className="h-2 w-full rounded-full ring-1 ring-inset ring-white/10"
          style={{ background: 'linear-gradient(90deg,#1e3a8a,#0ea5e9,#22d3ee,#34d399,#facc15,#f97316,#b91c1c)' }}
          aria-hidden
        />
        <div className="mt-1 flex items-center justify-between gap-2 text-[9px] text-slate-500">
          <span>cooler</span>
          <span className="text-center">GIBS render colormap · no pixel values read</span>
          <span>warmer</span>
        </div>
      </div>
    </Glass>
  );
}

function CenterPanel({ d, layerId, onJump }: { d: OceanDomain; layerId: string | null; onJump: () => void }) {
  const [tab, setTab] = useState<CenterTab>('Sea surface');
  const gapCopy = tab === 'Sea surface' ? null : TAB_NOT_CONNECTED[tab];
  return (
    <Glass className={`flex flex-col border ${RING} p-3`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-[0.16em] text-slate-400">Domain focus</span>
        <StatusBadge status="live" note="1 of 5 layers" />
      </div>

      <div className="relative mt-2 overflow-hidden rounded-xl border border-cyan-400/20 bg-slate-950/60">
        <div
          className="h-[132px] w-full"
          style={{
            background:
              'radial-gradient(circle at 32% 30%, rgba(56,189,248,.55), rgba(14,116,144,.35) 42%, rgba(2,6,23,.95) 78%), linear-gradient(160deg, rgba(34,211,238,.18), rgba(15,23,42,.2))',
          }}
          aria-hidden
        />
        <div className="absolute inset-0 grid place-items-center">
          <div className="text-center">
            <div className="text-[11px] font-semibold tracking-wide text-white">{d.aoi.name}</div>
            <div className="text-[9px] text-slate-300">{coordLabel(d.aoi.lat, d.aoi.lon)} · ocean AOI</div>
          </div>
        </div>
        <div className="absolute bottom-1 left-2 text-[8px] uppercase tracking-[0.18em] text-slate-500">decorative backdrop · not a data render</div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {CENTER_TABS.map((t) => {
          const active = t === tab;
          const live = t === 'Sea surface';
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md border px-1.5 py-[3px] text-[10px] transition ${
                active
                  ? 'border-cyan-400/50 bg-cyan-500/15 text-cyan-200'
                  : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-200'
              }`}
            >
              {t}
              {!live && <span className="ml-1 text-slate-600">·</span>}
            </button>
          );
        })}
      </div>

      <div className="mt-2 min-h-0 flex-1">
        {tab === 'Sea surface' ? (
          <div className="rounded-xl border border-cyan-400/20 bg-cyan-500/[0.06] p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-cyan-200">Live imagery layer</span>
              <StatusBadge status="live" />
            </div>
            <p className="mt-1 text-[10px] leading-snug text-slate-300">{d.imagery[0]?.title}</p>
            <p className="mt-1 break-all text-[9px] text-slate-500">{layerId ?? 'layer id missing from the domain file'}</p>
            <p className="mt-1.5 text-[10px] leading-snug text-slate-400">
              Render-only: the raster in the map card is a GIBS GetMap for the AOI window. No pixel value is sampled, so no SST number appears
              anywhere on this screen — the two numbers shown in the indicators are POWER marine air temperature and wind, not SST.
            </p>
            <button onClick={onJump} className="mt-1.5 text-[10px] text-cyan-300 hover:underline">
              See the real series →
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-amber-400/25 bg-amber-500/[0.05] p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-amber-200">{tab}</span>
              <StatusBadge status="not connected" />
            </div>
            <div className="mt-1 text-[20px] font-semibold leading-none text-slate-500">—</div>
            <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400">{gapCopy}</p>
          </div>
        )}
      </div>
    </Glass>
  );
}

function CollectionRow({ c }: { c: DataCollection }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-white/5 bg-white/[0.03] px-2 py-1.5">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11px] font-medium text-slate-200">{c.name}</div>
        <div className="truncate text-[9px] text-slate-500">{c.product}</div>
      </div>
      <div className="shrink-0 text-right">
        {c.used ? <StatusBadge status="live" note="used" /> : <StatusBadge status="not connected" />}
        <div className="mt-0.5 max-w-[150px] text-[9px] leading-tight text-slate-500">{c.note}</div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- module */

/** Ocean Intelligence — NASA POWER marine series + GIBS GHRSST SST, and the gaps stated plainly. */
export function OceanBoard() {
  const [d, setD] = useState<OceanDomain | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetchJson(OCEAN_DATA_URL, 9000)
      .then((raw: unknown) => {
        const parsed = asOceanDomain(raw);
        if (alive) setD(parsed);
      })
      .catch((e: Error) => alive && setErr(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const t2m = d ? seriesById(d, 't2m') : undefined;
  const ws2m = d ? seriesById(d, 'ws2m') : undefined;
  const sst = d ? sstLayer(d) : undefined;
  const layerId = sst?.gibs ?? null;
  const wmsUrl = d && sst?.gibs ? gibsUrl(sst.gibs, aoiBBox(d.aoi), 512) : null;
  const indicatorGaps = NOT_CONNECTED.filter((t) => t.showInIndicators);
  const usedCollections = DATA_COLLECTIONS.filter((c) => c.used);

  return (
    <div className="flex flex-col gap-3">
      {/* header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[22px] font-bold leading-tight tracking-tight text-white">Ocean Intelligence</h2>
          <p className="mt-0.5 text-[12px] text-slate-300">Global ocean and coastal monitoring with NASA Earthdata</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-xl border border-sky-300/25 bg-sky-500/10 px-3 py-1.5">
            <div className="flex items-center gap-2">
              <Icon name="Waves" className="h-3.5 w-3.5 text-sky-300" />
              <span className="text-[11px] font-semibold text-sky-100">NASA Earthdata</span>
              <span className="text-[10px] text-slate-400">·</span>
              <span className="text-[10px] text-slate-300">access path: GIBS + POWER (keyless)</span>
            </div>
          </div>
          <StatusBadge status="live" note="power + gibs live" />
        </div>
      </div>

      {loading && <Glass className="p-6 text-center text-[12px] text-slate-400">Loading ocean domain layer…</Glass>}
      {err && (
        <Glass className="border-amber-400/30 p-4 text-[12px] text-amber-200">
          Ocean domain layer failed to load ({err}). Run <code className="rounded bg-white/10 px-1">node scripts/build-domains.mjs</code> — nothing is
          shown rather than a guess.
        </Glass>
      )}

      {d && (
        <>
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,1fr)]">
            {/* left + centre */}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(230px,0.74fr)]">
              <MapCard d={d} layer={layerId ?? 'unavailable'} src={wmsUrl} />
              <CenterPanel d={d} layerId={layerId} onJump={() => { const el = document.getElementById('ocean-series'); el?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} />
            </div>

            {/* right stack */}
            <div className="flex flex-col gap-3">
              <Panel
                title="Ocean indicators"
                hint={`Latest complete month · ${d.aoi.name}`}
                right={<Chip className="shrink-0">2 live · 2 gaps</Chip>}
              >
                <div className="grid grid-cols-2 gap-2">
                  <LiveTile
                    label={t2m?.label ?? 'Marine air temperature'}
                    value={fmt(t2m?.latest, 1)}
                    unit={t2m?.unit ?? '°C'}
                    note="POWER T2M over ocean — air temperature, not SST"
                  />
                  <LiveTile
                    label={ws2m?.label ?? 'Wind speed at 2 m'}
                    value={fmt(ws2m?.latest, 1)}
                    unit={ws2m?.unit ?? 'm/s'}
                    note="POWER WS2M monthly mean at this AOI"
                  />
                  {indicatorGaps.map((t) => (
                    <GapTile key={t.id} tile={t} compact />
                  ))}
                </div>
              </Panel>

              <div id="ocean-series">
                <Panel
                  title="Time series"
                  hint={`${d.coverage.window} · POWER monthly`}
                  right={<span className="shrink-0 text-[9px] text-slate-500">no interpolation</span>}
                >
                  <OceanSeriesChart a={t2m} b={ws2m} />
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-3 rounded-full bg-cyan-400" />
                      {t2m?.label} {t2m ? `${fmt(t2m.latest, 1)} ${t2m.unit}` : ''}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="h-1.5 w-3 rounded-full bg-yellow-400" />
                      {ws2m?.label} {ws2m ? `${fmt(ws2m.latest, 1)} ${ws2m.unit}` : ''}
                    </span>
                  </div>
                  <p className="mt-1 text-[9px] leading-snug text-slate-500">
                    {t2m?.months.length ?? 0} monthly samples · separate scales per line, so the two curves compare shape, not magnitude.
                  </p>
                </Panel>
              </div>

              <Panel title="Data collections" hint={`${usedCollections.length} used of ${DATA_COLLECTIONS.length} listed`}>
                <div className="flex flex-col gap-1.5">
                  {DATA_COLLECTIONS.map((c) => (
                    <CollectionRow key={c.id} c={c} />
                  ))}
                </div>
              </Panel>
            </div>
          </div>

          {/* explicit gaps */}
          <Glass className={`border ${RING} p-3`}>
            <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="text-[13px] font-semibold text-white">Not sourced in this build</h3>
                <p className="text-[10px] text-slate-400">Each tile is a named gap with a reason — a dash, never a zero and never a placeholder number.</p>
              </div>
              <Chip className="shrink-0">{NOT_CONNECTED.length} products</Chip>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {NOT_CONNECTED.map((t) => (
                <GapTile key={t.id} tile={t} />
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-amber-200/80">{NOT_CONNECTED_FOOTNOTE}</p>
          </Glass>

          {/* coverage */}
          <Glass className={`border ${RING} p-3`}>
            <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h3 className="text-[13px] font-semibold text-white">Coverage</h3>
                <p className="text-[10px] text-slate-400">
                  POWER monthly request {d.coverage.start} → {d.coverage.end} · series window {d.coverage.window}
                </p>
              </div>
              <span className="text-[9px] text-slate-500">filled cell = a month the file carries a value for</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {coverageCells(d, t2m?.months ?? []).map((cell) => (
                <div
                  key={cell.key}
                  className={`min-w-[2.1rem] rounded-md border px-1 py-1 text-center ${
                    cell.hasSample ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200' : 'border-white/10 bg-white/[0.02] text-slate-500'
                  }`}
                  title={cell.hasSample ? `${cell.label} ${cell.year} — value present` : `${cell.label} ${cell.year} — no sample carried`}
                >
                  <div className="text-[10px] leading-none">{cell.label}</div>
                  <div className="mt-0.5 text-[8px] leading-none opacity-70">{cell.year}</div>
                </div>
              ))}
            </div>
          </Glass>

          <Provenance
            honesty={d.provenance.honesty === 'live' ? 'live' : 'snapshot'}
            coverage={{ start: d.coverage.start ?? '', end: d.coverage.end ?? '', label: `${d.coverage.window} · POWER monthly, latest complete month` }}
            citation={`ORBIT OS · ${d.provenance.provider} · access ${d.provenance.access}`}
            sources={[
              { name: 'NASA POWER', url: d.provenance.url, note: 'T2M · WS2M monthly point API, community=RE' },
              { name: 'NASA GIBS', url: wmsUrl ?? 'https://gibs.earthdata.nasa.gov/', note: `${layerId ?? 'GHRSST MUR L4'} via WMS 1.1.1, TIME ${GIBS_DATE}` },
              { name: 'NASA Earthdata', url: 'https://www.earthdata.nasa.gov/', note: 'keyless access path for both providers' },
            ]}
          />

          <p className="text-[11px] leading-relaxed text-slate-400">
            Honesty: marine air temperature is POWER T2M sampled over the ocean (community=RE) — it is air temperature, not sea-surface temperature.
            SST is the GHRSST MUR L4 layer rendered by NASA GIBS for the AOI window, and this screen never reads its pixel values back. Every other
            ocean product (ocean colour, currents, sea level, sea-ice, coastal change, alerts, marine health) has no connector in this build, so those
            tiles stay empty with a stated reason instead of carrying a number nobody measured.
          </p>
        </>
      )}
    </div>
  );
}
