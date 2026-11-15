import { useState } from 'react';
import { Chip, Glass, Icon, StatusBadge } from '../components/ui';
import { Provenance } from '../components/Provenance';
import { WorkflowStrip } from '../components/WorkflowStrip';
import {
  ACQUISITIONS,
  ANALYSIS_TILES,
  ANALYST_COPY,
  AOI,
  DEMO_CLAUSE,
  DEMO_NOTE,
  EARTHDATA_CARD,
  FOOTERS,
  JOBS_SHOWN,
  KPIS,
  LAYERS,
  LAYER_DEFAULTS,
  LOS_ASSETS,
  LOS_LEGEND,
  PANEL_TABS,
  PROCESSING_JOBS,
  PROVENANCE_CITATION,
  PROVENANCE_META,
  PROVENANCE_SOURCES,
  INFRASTRUCTURE_TYPES,
  QUALITY,
  SPECKLE_COLS,
  TAB_NOTES,
  TIME_SERIES,
  TS_MONTHS,
  TS_Y_MAX,
  TS_Y_MIN,
  TS_Y_TICKS,
  losColor,
  type Acquisition,
  type KpiTone,
  type LayerId,
  type PanelTab,
} from '../data/osloSar';

/* ------------------------------------------------------------------ *
 * Infrastructure Intelligence — Oslo SAR/InSAR (CONCEPT DEMO)
 *
 * The page header is rendered by ModulePage; this component starts at
 * the Earthdata status card + KPI strip.
 *
 * Every panel that shows a displacement number carries a visible
 * sample badge and a footer saying the value is synthetic. The
 * Earthdata / ASF / HyP3 line is design copy only — no session is
 * opened and no product is fetched by this component.
 * ------------------------------------------------------------------ */

/** mm formatter using a true minus sign, e.g. −3.1 / +2.0. */
const fmtMm = (v: number) => `${v < 0 ? '−' : '+'}${Math.abs(v).toFixed(1)}`;

const KPI_ACCENT: Record<KpiTone, { text: string; icon: string; bg: string }> = {
  sky: { text: 'text-sky-300', icon: 'text-sky-300', bg: 'border-sky-300/20' },
  amber: { text: 'text-amber-300', icon: 'text-amber-300', bg: 'border-amber-300/20' },
  rose: { text: 'text-rose-300', icon: 'text-rose-300', bg: 'border-rose-300/25' },
  emerald: { text: 'text-emerald-300', icon: 'text-emerald-300', bg: 'border-emerald-300/20' },
  slate: { text: 'text-slate-300', icon: 'text-slate-300', bg: 'border-white/10' },
  violet: { text: 'text-violet-300', icon: 'text-violet-300', bg: 'border-violet-300/20' },
};

const SEVERITY_CHIP: Record<string, string> = {
  high: 'border-rose-400/40 bg-rose-500/15 text-rose-200',
  moderate: 'border-amber-400/40 bg-amber-500/15 text-amber-200',
  low: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
};

const URBAN_PATCHES = [
  { left: '58%', top: '18%', width: '17%', height: '13%' },
  { left: '44%', top: '54%', width: '22%', height: '15%' },
  { left: '20%', top: '40%', width: '14%', height: '12%' },
];

/* ------------------------------ chart ----------------------------- */
const CH_W = 360;
const CH_H = 186;
const CH_PL = 40;
const CH_PR = 12;
const CH_PT = 12;
const CH_PB = 26;
const chX = (x: number) => CH_PL + (x / (TS_MONTHS.length - 1)) * (CH_W - CH_PL - CH_PR);
const chY = (y: number) => CH_PT + (1 - (y - TS_Y_MIN) / (TS_Y_MAX - TS_Y_MIN)) * (CH_H - CH_PT - CH_PB);

function DisplacementChart() {
  return (
    <div className="mt-2">
      <svg viewBox={`0 0 ${CH_W} ${CH_H}`} className="w-full" role="img" aria-label="Synthetic line-of-sight displacement, June to November, millimetres. Sample data.">
        <text x={11} y={CH_H / 2} textAnchor="middle" fontSize="8" fill="#64748b" transform={`rotate(-90 11 ${CH_H / 2})`}>
          Displacement (mm)
        </text>
        {TS_Y_TICKS.map((t) => (
          <g key={t}>
            <line
              x1={CH_PL}
              x2={CH_W - CH_PR}
              y1={chY(t)}
              y2={chY(t)}
              stroke={t === 0 ? '#64748b' : '#1e293b'}
              strokeDasharray={t === 0 ? undefined : '2 4'}
              strokeOpacity={t === 0 ? 0.8 : 1}
            />
            <text x={CH_PL - 6} y={chY(t) + 3} textAnchor="end" fontSize="9" fill="#94a3b8">
              {t}
            </text>
          </g>
        ))}
        {TS_MONTHS.map((m, i) => (
          <text key={m} x={chX(i)} y={CH_H - 8} textAnchor="middle" fontSize="9" fill="#94a3b8">
            {m}
          </text>
        ))}
        {TIME_SERIES.map((s) => (
          <g key={s.id}>
            <polyline
              points={s.points.map((p) => `${chX(p.x).toFixed(1)},${chY(p.y).toFixed(1)}`).join(' ')}
              fill="none"
              stroke={s.color}
              strokeWidth="1.8"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {s.points.map((p) => (
              <circle key={p.x} cx={chX(p.x)} cy={chY(p.y)} r="2.2" fill={s.color}>
                <title>{`${s.label} · ${TS_MONTHS[p.x]} · ${fmtMm(p.y)} mm (sample)`}</title>
              </circle>
            ))}
          </g>
        ))}
      </svg>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400">
        {TIME_SERIES.map((s) => (
          <span key={s.id} className="inline-flex items-center gap-1">
            <span className="h-1.5 w-3 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
        <span className="ml-auto text-[9px] uppercase tracking-wide text-amber-300/80">sample</span>
      </div>
    </div>
  );
}

/* ------------------------- acquisition thumb ---------------------- */
function SpeckleThumb({ a }: { a: Acquisition }) {
  return (
    <div
      className="grid shrink-0 gap-[1px] overflow-hidden rounded-[3px] border border-white/10 bg-[#050a16]"
      style={{ gridTemplateColumns: `repeat(${SPECKLE_COLS}, 1fr)`, width: 42 }}
      title="SAR thumbnail placeholder — deterministic speckle pattern, not imagery"
      aria-hidden="true"
    >
      {a.speckle.map((v, i) => (
        <div key={i} className="aspect-square" style={{ background: `rgba(148,163,184,${(0.05 + v * 0.55).toFixed(2)})` }} />
      ))}
    </div>
  );
}

/* ------------------------------- map ------------------------------ */
function AoiCanvas({
  layers,
  active,
  onActive,
}: {
  layers: Record<LayerId, boolean>;
  active: string | null;
  onActive: (id: string) => void;
}) {
  return (
    <div
      className={`relative h-[340px] w-full overflow-hidden rounded-xl border border-sky-300/15 bg-[#050a16] sm:h-[380px] transition ${active ? 'ring-1 ring-sky-400/20' : ''}`}
      style={{
        backgroundImage:
          'linear-gradient(rgba(148,163,184,.085) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.085) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
      }}
    >
      {/* atmosphere wash */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(120% 85% at 50% 0%, rgba(14,165,233,.10), rgba(2,6,15,0) 62%)' }}
      />

      {/* elevation contours (layer: Elevation (DEM)) */}
      {layers.dem && (
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          title="Contour hint only — no DEM tiles are loaded"
          style={{ backgroundImage: 'repeating-linear-gradient(115deg, rgba(148,163,184,.20) 0 1px, rgba(0,0,0,0) 1px 24px)' }}
        />
      )}

      {/* water bodies (layer: Water Bodies) */}
      {layers.water && (
        <div
          className="absolute border border-sky-800/70"
          title="Maridalsvannet — stylized water shape, not a mapped coastline"
          style={{
            left: '5%',
            top: '3%',
            width: '31%',
            height: '25%',
            borderRadius: '46% 54% 58% 42% / 52% 44% 56% 48%',
            background: 'radial-gradient(62% 62% at 38% 34%, rgba(12,74,110,.9), rgba(7,29,48,.95))',
          }}
        />
      )}

      {/* urban areas (layer: Urban Areas) */}
      {layers.urban &&
        URBAN_PATCHES.map((p, i) => (
          <div
            key={i}
            className="absolute rounded-md border border-slate-500/20 bg-slate-600/25"
            title="Urban extent — stylized block, not a land-use layer"
            style={p}
          />
        ))}

      {/* deformation heat field (layer: SAR Deformation (LOS)) */}
      {layers.deformation &&
        LOS_ASSETS.map((a) => {
          const c = losColor(a.displacementMm);
          return (
            <div
              key={a.id}
              className="pointer-events-none absolute"
              style={{
                left: `${a.x}%`,
                top: `${a.y}%`,
                width: `${a.blobWidth}%`,
                height: `${a.blobWidth * 0.92}%`,
                transform: 'translate(-50%,-50%)',
                borderRadius: '50%',
                background: `radial-gradient(circle at center, ${c}f0 0%, ${c}aa 42%, ${c}00 74%)`,
                filter: 'blur(1.5px)',
              }}
            />
          );
        })}

      {/* infrastructure linework (layer: Infrastructure) */}
      {layers.infrastructure && (
        <>
          <div
            className="absolute rounded-full"
            title="E6 corridor — stylized linework"
            style={{
              left: '38%',
              top: '56%',
              width: '48%',
              height: 3,
              transform: 'rotate(24deg)',
              transformOrigin: 'left center',
              background: 'linear-gradient(90deg, rgba(251,191,36,.15), rgba(251,191,36,.9))',
            }}
          />
          <div
            className="absolute rounded-full"
            title="Akerselva river corridor — stylized linework"
            style={{
              left: '52%',
              top: '30%',
              width: 2,
              height: '34%',
              transform: 'rotate(-9deg)',
              background: 'rgba(56,189,248,.55)',
            }}
          />
          <div
            className="absolute rounded-sm border border-dashed border-slate-400/40"
            title="Haraldrud industrial zone — stylized outline"
            style={{ left: '30%', top: '66%', width: '18%', height: '16%' }}
          />
          <div
            className="absolute rounded-sm"
            title="Maridalsvannet dam crest — stylized linework"
            style={{ left: '9%', top: '26%', width: '22%', height: 3, transform: 'rotate(6deg)', background: 'rgba(226,232,240,.75)' }}
          />
        </>
      )}

      {/* satellite footprints (layer: Satellite Footprints) */}
      {layers.footprints && (
        <>
          <div
            className="absolute rounded-md border border-dashed border-sky-400/45"
            title="NISAR swath footprint — stylized, not a real orbit polygon"
            style={{ left: '12%', top: '18%', width: '58%', height: '46%', transform: 'rotate(-7deg)' }}
          />
          <div
            className="absolute rounded-md border border-dashed border-violet-400/40"
            title="Sentinel-1 swath footprint — stylized, not a real orbit polygon"
            style={{ left: '34%', top: '42%', width: '55%', height: '42%', transform: 'rotate(9deg)' }}
          />
        </>
      )}

      {/* asset markers + callouts */}
      {LOS_ASSETS.map((a) => {
        const c = losColor(a.displacementMm);
        const on = active === a.id;
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => onActive(a.id)}
            className="absolute -translate-x-1/2 text-left"
            style={{ left: `${a.x}%`, top: `${a.y}%` }}
            title={`${a.name} · ${a.kind} · sample LOS displacement (${fmtMm(a.displacementMm)} mm)`}
          >
            <span className="mx-auto block h-2.5 w-2.5 rounded-full ring-2 ring-slate-950/80" style={{ background: c }} />
            <span
              className={`mt-1 block whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[10px] font-semibold shadow-lg backdrop-blur transition ${
                on ? 'border-sky-300/60 bg-slate-950/95 text-white' : 'border-white/15 bg-slate-950/80 text-slate-200'
              }`}
            >
              <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: c }} />
              {a.shortName} <span className="font-mono" style={{ color: c }}>{fmtMm(a.displacementMm)} mm</span>
            </span>
          </button>
        );
      })}

      {/* compass */}
      <div className="absolute right-3 top-3 flex flex-col items-center gap-[1px] rounded-lg border border-white/10 bg-slate-950/75 px-2 py-1" title="North is up in this stylized view">
        <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true">
          <path d="M5 0 L9 10 L5 7.5 L1 10 Z" fill="#7dd3fc" />
        </svg>
        <span className="text-[9px] font-bold leading-none tracking-widest text-slate-300">N</span>
      </div>

      {/* scale bar */}
      <div className="absolute bottom-3 left-3" title="Indicative scale only — the AOI is stylized and not georeferenced">
        <div className="h-[3px] w-16 rounded-full" style={{ background: 'linear-gradient(90deg, rgba(226,232,240,.9), rgba(226,232,240,.35))' }} />
        <div className="mt-1 flex w-16 justify-between text-[9px] leading-none text-slate-400">
          <span>0</span>
          <span>5 km · schematic</span>
        </div>
      </div>

      {/* AOI tag */}
      <div className="absolute left-3 top-3 rounded-md border border-white/10 bg-slate-950/75 px-2 py-1 text-[10px] leading-none text-slate-300">
        Oslo · {AOI.lat.toFixed(2)}°N {AOI.lon.toFixed(2)}°E
        <span className="ml-1 text-amber-300/90">· stylized AOI · demo</span>
      </div>
    </div>
  );
}

/* --------------------------- main component ----------------------- */
export function InfrastructureOslo() {
  const [tab, setTab] = useState<PanelTab>('map');
  const [layers, setLayers] = useState<Record<LayerId, boolean>>(LAYER_DEFAULTS);
  const [activeAsset, setActiveAsset] = useState<string | null>('e6');
  const [activeTile, setActiveTile] = useState('stability');
  const [analystNote, setAnalystNote] = useState(false);

  const toggleLayer = (id: LayerId) => setLayers((prev) => ({ ...prev, [id]: !prev[id] }));
  const selectedTile = ANALYSIS_TILES.find((t) => t.id === activeTile) ?? ANALYSIS_TILES[0];
  const shownJobs = PROCESSING_JOBS.slice(0, JOBS_SHOWN);

  return (
    <div className="space-y-3">
      {/* ---------------- Earthdata status card ---------------- */}
      <Glass className="p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-xl border border-sky-300/20 bg-sky-500/10 p-2">
              <Icon name="Earth" className="h-5 w-5 text-sky-300" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-white">{EARTHDATA_CARD.title}</span>
                <StatusBadge status="sample" note="demo session" />
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[12px] font-semibold text-emerald-300">
                <Icon name="CircleCheck" className="h-3.5 w-3.5" />
                {EARTHDATA_CARD.state}
              </div>
              <div className="text-[11px] text-slate-400">{EARTHDATA_CARD.detail}</div>
              <div className="mt-0.5 flex items-start gap-1 text-[10px] leading-snug text-amber-300/90">
                <Icon name="TriangleAlert" className="mt-[1px] h-3 w-3 shrink-0" />
                <span>{EARTHDATA_CARD.caveat}</span>
              </div>
            </div>
          </div>
          <button type="button" className="btn-ghost !py-1.5 text-xs" title="Decorative control — account management is outside this demo">
            Manage Account <span className="text-slate-400">↗</span>
          </button>
        </div>
      </Glass>

      {/* ---------------- KPI strip ---------------- */}
      <div>
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[10px] uppercase tracking-wide text-slate-500">Mission readout</span>
          <div className="flex items-center gap-2">
            <span className="rounded border border-white/15 bg-white/5 px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-wide text-slate-300">
              live products on this board: 0
            </span>
            <StatusBadge status="sample" note={DEMO_NOTE} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
          {KPIS.map((k) => {
            const tone = KPI_ACCENT[k.tone];
            return (
              <Glass key={k.id} className={`p-3 ${tone.bg}`}>
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] uppercase tracking-wide text-slate-400">{k.label}</span>
                  <Icon name={k.icon} className={`h-3.5 w-3.5 ${tone.icon}`} />
                </div>
                <div className="mt-1 text-xl font-bold leading-none text-white">{k.value}</div>
                <div className={`mt-1 text-[11px] leading-tight ${tone.text}`}>{k.sub}</div>
              </Glass>
            );
          })}
        </div>
      </div>

      {/* ---------------- main grid ---------------- */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
        {/* ---- left: map panel ---- */}
        <Glass className="overflow-hidden p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
            <div className="flex items-center gap-1" role="tablist" aria-label="AOI views">
              {PANEL_TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                    tab === t.id ? 'bg-sky-500/20 text-sky-100 ring-1 ring-sky-400/40' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden text-[10px] text-slate-500 sm:inline">AOI · {AOI.name}</span>
              <StatusBadge status="sample" note="stylized AOI · demo" />
            </div>
          </div>

          <div className="p-3">
            {tab === 'map' ? (
              <AoiCanvas layers={layers} active={activeAsset} onActive={setActiveAsset} />
            ) : (
              <div className="flex h-[340px] w-full flex-col items-center justify-center gap-2 rounded-xl border border-white/10 bg-slate-950/40 p-6 text-center sm:h-[380px]">
                <Icon name={TAB_NOTES[tab].icon} className="h-7 w-7 text-slate-500" />
                <div className="text-[13px] font-semibold text-slate-200">{PANEL_TABS.find((t) => t.id === tab)?.label} view — not built in this demo</div>
                <p className="max-w-md text-[11px] leading-relaxed text-slate-400">{TAB_NOTES[tab].text}</p>
                <StatusBadge status="not connected" note="no data loaded" />
              </div>
            )}
          </div>

          {/* legend + layers */}
          <div className="grid grid-cols-1 gap-3 border-t border-white/10 px-3 py-3 md:grid-cols-2">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-wide text-slate-400">LOS Deformation (mm)</span>
                <span className="text-[9px] uppercase tracking-wide text-amber-300/80">sample</span>
              </div>
              <div className="mt-1.5 flex h-2.5 w-full overflow-hidden rounded">
                {LOS_LEGEND.map((s) => (
                  <div key={s.label} className="flex-1" style={{ background: s.color }} />
                ))}
              </div>
              <div className="mt-1 grid grid-cols-8 text-[9px] text-slate-400">
                {LOS_LEGEND.map((s) => (
                  <span key={s.label} className="text-center">{s.label}</span>
                ))}
              </div>
              <p className="mt-2 text-[10px] leading-snug text-slate-500">
                Negative = away from the satellite (settling / subsidence). Positive = toward the satellite. Line-of-sight only — never 3-D motion.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1">
                <span className="text-[9px] uppercase tracking-wide text-slate-500">AOI scope</span>
                {INFRASTRUCTURE_TYPES.map((t) => (
                  <Chip key={t} className="border-sky-300/20 text-slate-300">
                    {t}
                  </Chip>
                ))}
              </div>
              {activeAsset && (
                <p className="mt-1 text-[10px] leading-snug text-slate-400">
                  Selected: <b className="text-slate-200">{LOS_ASSETS.find((a) => a.id === activeAsset)?.name}</b> ·{' '}
                  {fmtMm(LOS_ASSETS.find((a) => a.id === activeAsset)?.displacementMm ?? 0)} mm LOS · 1σ ±
                  {(LOS_ASSETS.find((a) => a.id === activeAsset)?.uncertaintyMm ?? 0).toFixed(1)} mm (sample)
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-wide text-slate-400">Layers</span>
                <span className="text-[9px] uppercase tracking-wide text-slate-500">stylized · no tile service</span>
              </div>
              <div className="mt-1.5 space-y-1">
                {LAYERS.map((l) => {
                  const on = layers[l.id];
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => toggleLayer(l.id)}
                      aria-pressed={on}
                      className="flex w-full items-start gap-2 rounded-lg border border-white/5 bg-white/[.02] px-2 py-1.5 text-left transition hover:border-sky-300/25 hover:bg-white/[.04]"
                    >
                      <span
                        className={`mt-[1px] grid h-3.5 w-3.5 shrink-0 place-items-center rounded border text-[9px] font-bold leading-none ${
                          on ? 'border-sky-400/60 bg-sky-500/30 text-sky-100' : 'border-white/25 text-transparent'
                        }`}
                        aria-hidden="true"
                      >
                        {on ? '✓' : ''}
                      </span>
                      <span className="min-w-0">
                        <span className={`block text-[11px] font-medium ${on ? 'text-slate-100' : 'text-slate-400'}`}>{l.label}</span>
                        {l.detail ? <span className="block text-[9px] uppercase tracking-wide text-slate-500">{l.detail}</span> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 px-3 py-2 text-[10px] leading-snug text-slate-500">
            {FOOTERS.map} {FOOTERS.layers}
          </div>
        </Glass>

        {/* ---- right: stacked cards ---- */}
        <div className="space-y-3">
          {/* Satellite acquisitions */}
          <Glass className="p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="h-title">Satellite Acquisitions (AOI)</div>
              <button type="button" className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-300 hover:underline" title="Decorative — no catalogue is queried in this build">
                View Catalog <Icon name="ArrowRight" className="h-3 w-3" />
              </button>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="text-[10px] text-slate-500">
                {AOI.name} · {AOI.lat.toFixed(2)}°N {AOI.lon.toFixed(2)}°E
              </span>
              <StatusBadge status="sample" note="illustrative records (demo)" />
            </div>
            <div className="mt-2 space-y-1.5">
              {ACQUISITIONS.map((a) => (
                <div key={a.id} className="flex items-center gap-2.5 rounded-lg border border-white/5 bg-white/[.02] px-2 py-1.5">
                  <SpeckleThumb a={a} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-semibold text-white">
                      {a.mission} <span className="font-normal text-slate-400">({a.band})</span>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {a.date} · {a.product} · {a.resolution}
                    </div>
                  </div>
                  <span title="Illustrative record — no catalogue query was made" className="shrink-0 rounded border border-amber-400/30 bg-amber-500/10 px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-wide text-amber-300">
                    demo
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-snug text-slate-500">{FOOTERS.acquisitions}</p>
          </Glass>

          {/* Deformation time series */}
          <Glass className="p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="h-title">Deformation Time Series</div>
              <StatusBadge status="sample" note="synthetic series" />
            </div>
            <DisplacementChart />
            <p className="mt-1 text-[10px] leading-snug text-slate-500">{FOOTERS.timeseries}</p>
          </Glass>

          {/* Processing jobs */}
          <Glass className="p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="h-title">Processing Jobs</div>
              <button type="button" className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-300 hover:underline" title="Decorative — no job queue exists in this build">
                View All <Icon name="ArrowRight" className="h-3 w-3" />
              </button>
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <span className="text-[10px] text-slate-500">HyP3 · simulated queue</span>
              <StatusBadge status="sample" note="simulated jobs" />
            </div>
            <div className="mt-2 space-y-1.5">
              {shownJobs.map((j) => {
                const running = j.state === 'running';
                return (
                  <div key={j.id} className="rounded-lg border border-white/5 bg-white/[.02] px-2 py-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate text-[11px] font-medium text-slate-100">{j.label}</span>
                      {running ? (
                        <span className="shrink-0 text-[10px] font-semibold text-sky-300">{j.progress}%</span>
                      ) : (
                        <span className="shrink-0 rounded border border-white/15 bg-white/5 px-1.5 py-[1px] text-[9px] font-semibold uppercase text-slate-300">sim done</span>
                      )}
                    </div>
                    {running ? (
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded bg-white/10">
                        <div className="h-1.5 rounded" style={{ width: `${j.progress}%`, background: '#38bdf8' }} />
                      </div>
                    ) : null}
                    <div className={`mt-1 text-[10px] ${running ? 'text-sky-200/90' : 'text-emerald-300/90'}`}>{j.detail}</div>
                  </div>
                );
              })}
            </div>
            <p className="mt-2 text-[10px] leading-snug text-slate-500">{FOOTERS.jobs}</p>
          </Glass>

          {/* Uncertainty & quality */}
          <Glass className="p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="h-title">Uncertainty &amp; Quality</div>
              <StatusBadge status="sample" note={DEMO_NOTE} />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {QUALITY.map((q) => (
                <div key={q.label} className="rounded-lg border border-white/5 bg-white/[.02] px-2 py-1.5">
                  <div className="text-[9px] uppercase tracking-wide text-slate-500">{q.label}</div>
                  <div
                    className={`mt-0.5 text-[13px] font-bold ${
                      q.tone === 'emerald' ? 'text-emerald-300' : q.tone === 'amber' ? 'text-amber-300' : q.tone === 'sky' ? 'text-sky-200' : 'text-slate-200'
                    }`}
                  >
                    {q.value}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-snug text-slate-500">
              Reference figures only: an InSAR 1σ near ±4 mm and coherence near 0.8 are typical order-of-magnitude expectations — they are not computed from a product here.
            </p>
          </Glass>

          {/* Provenance & metadata */}
          <Glass className="p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="h-title">Provenance &amp; Metadata</div>
              <button type="button" className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-300 hover:underline" title="Decorative — no product metadata is available in this build">
                View Details <Icon name="ArrowRight" className="h-3 w-3" />
              </button>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <span className="text-[10px] text-slate-500">Product template</span>
              <StatusBadge status="sample" note={DEMO_NOTE} />
            </div>
            <dl className="mt-2 space-y-1 text-[11px]">
              {PROVENANCE_META.map((m) => (
                <div key={m.label} className="flex items-baseline justify-between gap-2 border-b border-white/5 pb-1 last:border-0">
                  <dt className="shrink-0 text-slate-500">{m.label}</dt>
                  <dd className="text-right font-medium text-slate-200">{m.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-400/25 bg-amber-500/10 px-2 py-1.5 text-[10px] leading-snug text-amber-200/90">
              <Icon name="TriangleAlert" className="mt-[1px] h-3 w-3 shrink-0" />
              <span>{DEMO_CLAUSE}</span>
            </p>
          </Glass>
        </div>
      </div>

      {/* ---------------- bottom: analysis + analyst ---------------- */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
        <Glass className="p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="h-title">Analysis &amp; Applications</div>
            <span className="text-[10px] text-slate-500">select a view</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
            {ANALYSIS_TILES.map((t) => {
              const on = t.id === activeTile;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTile(t.id)}
                  aria-pressed={on}
                  className={`flex flex-col items-start gap-1 rounded-xl border px-2 py-2 text-left transition ${
                    on
                      ? 'border-sky-400/45 bg-sky-500/15 text-sky-100 shadow-[0_0_24px_-12px_rgba(56,189,248,.8)]'
                      : 'border-white/10 bg-white/[.03] text-slate-300 hover:border-sky-300/30 hover:bg-white/[.06]'
                  }`}
                >
                  <Icon name={t.icon} className={`h-4 w-4 ${on ? 'text-sky-300' : 'text-slate-400'}`} />
                  <span className="text-[11px] font-semibold leading-tight">{t.label}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[10px] leading-snug text-slate-500">
            <b className="text-slate-400">{selectedTile.label}</b> — {selectedTile.hint} Views are selectors only in this build; no analysis is executed.
          </p>
        </Glass>

        <Glass className="relative overflow-hidden p-3">
          <div
            className="pointer-events-none absolute inset-0 opacity-70"
            style={{ background: 'radial-gradient(80% 120% at 100% 0%, rgba(139,92,246,.22), rgba(2,6,15,0) 65%)' }}
          />
          <div className="relative">
            <div className="flex items-center gap-2">
              <div className="rounded-xl border border-violet-300/25 bg-violet-500/15 p-1.5">
                <Icon name="BrainCircuit" className="h-4 w-4 text-violet-300" />
              </div>
              <div className="h-title">AI Infrastructure Analyst</div>
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-slate-300">{ANALYST_COPY}</p>
            <button
              type="button"
              onClick={() => setAnalystNote(true)}
              className="btn-primary mt-2 !py-1.5 text-xs"
              title="Decorative in this build — no model is called"
            >
              <Icon name="Sparkles" className="h-3.5 w-3.5" />
              Ask the analyst
              <Icon name="ArrowRight" className="h-3.5 w-3.5" />
            </button>
            {analystNote ? (
              <p className="mt-1.5 text-[10px] leading-snug text-amber-300/90">
                Not connected — this button is decorative; no language model is called and no answer is generated in this build.
              </p>
            ) : (
              <p className="mt-1.5 text-[10px] leading-snug text-slate-500">Answers would be grounded in the panels above — which are sample data here.</p>
            )}
          </div>
        </Glass>
      </div>

      {/* ---------------- pipeline + provenance ---------------- */}
      <Glass className="p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[10px] uppercase tracking-wide text-slate-400">From Earthdata to Evidence</span>
          <span className="text-[10px] text-slate-500">no pipeline step has run in this build — this page sits at Discover</span>
        </div>
        <WorkflowStrip active={0} className="mt-2" />
      </Glass>

      <Provenance
        sources={PROVENANCE_SOURCES}
        coverage={{ start: '2026-06-01', end: '2026-11-14', label: `AOI ${AOI.name} · concept demo window (${AOI.extentNote})` }}
        honesty="sample"
        citation={`AOI ${AOI.name} · ${PROVENANCE_CITATION}`}
      />
    </div>
  );
}

export default InfrastructureOslo;
