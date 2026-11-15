import { useMemo, useState } from 'react';
import { Glass, Icon, StatusBadge } from '../components/ui';
import { Provenance } from '../components/Provenance';
import { WorkflowStrip } from '../components/WorkflowStrip';
import { isoDay } from '../data/events';
import {
  BEFORE_AFTER_THUMBS,
  HEADLINE_WINDOW_DAYS,
  LAYER_TOGGLES,
  MAP_CAPTION,
  PROVENANCE_CITATION,
  PROVENANCE_SOURCES,
  SAMPLE_ATTRIBUTION,
  SAMPLE_CLAUSE,
  SAMPLE_INDICATORS,
  SAMPLE_SEED,
  THUMB_NOTE,
  changeTimeline,
  fmtMag,
  headlineCoords,
  headlineLine,
  pickHeadlineEvent,
  trimNum,
  type LayerId,
} from '../data/disasterBoard';
import { useStore } from '../state/store';

/** Amber badge carried by every card that shows a sample figure. */
function SampleBadge({ className = '' }: { className?: string }) {
  return (
    <span
      title="Fixed-seed sample value — no NISAR/Sentinel-1 product is queried in this build"
      className={`shrink-0 rounded border border-amber-400/40 bg-amber-500/15 px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wider text-amber-300 ${className}`}
    >
      SAMPLE
    </span>
  );
}

/** Ring class per toggle — only local styling changes when toggled. */
const RING_ON: Record<LayerId, string> = {
  sar: 'border-sky-400/70 shadow-[0_0_28px_rgba(56,189,248,.16)]',
  flood: 'border-blue-400/70 shadow-[0_0_28px_rgba(59,130,246,.16)]',
  fire: 'border-rose-400/70 shadow-[0_0_28px_rgba(244,63,94,.16)]',
  response: 'border-emerald-400/60 border-dashed shadow-[0_0_28px_rgba(52,211,153,.14)]',
};

const BAR_TONE: Record<string, string> = {
  sar: 'bg-sky-400',
  flood: 'bg-blue-400',
  fire: 'bg-rose-400',
  confidence: 'bg-emerald-400',
};

export function DisasterEventBoard() {
  const { db, dbError } = useStore();
  const headline = useMemo(() => pickHeadlineEvent(db), [db]);
  const [layers, setLayers] = useState<Record<LayerId, boolean>>({ sar: true, flood: true, fire: false, response: false });
  const timeline = useMemo(() => (db && headline ? changeTimeline(db, headline) : []), [db, headline]);
  const toggle = (id: LayerId) => setLayers((s) => ({ ...s, [id]: !s[id] }));

  return (
    <div className="flex flex-col gap-3">
      {/* ------------------------------ header ------------------------------ */}
      <Glass className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-xl border border-rose-400/40 bg-rose-500/10 p-2">
              <Icon name="Target" className="h-6 w-6 text-rose-300" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-white">Disaster Watch</h1>
                {db ? <StatusBadge status={db.status} note={db.label} /> : <StatusBadge status="not connected" note="harvest not loaded" />}
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                One real seismic event from the harvest, with radar / flood / fire impact panels that are sample data in this build.
              </p>
            </div>
          </div>
          <div className="text-right text-[10px] text-slate-500">
            <div>{db ? `${db.events.length.toLocaleString('en-US')} harvest records` : 'waiting for harvest…'}</div>
            <div>sample seed {SAMPLE_SEED}</div>
          </div>
        </div>

        {/* -------- headline: the REAL event, or an honest neutral panel -------- */}
        {headline ? (
          <div className="mt-3 rounded-xl border border-rose-400/30 bg-rose-500/[.07] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded border border-emerald-400/30 bg-emerald-500/10 px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                real · USGS catalogue
              </span>
              <span className="text-[10px] uppercase tracking-wide text-rose-200/70">headline event</span>
            </div>
            <div className="mt-1 text-[15px] font-semibold leading-snug text-white">{headlineLine(headline)}</div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400">
              <span className="font-mono text-slate-300">{headlineCoords(headline)}</span>
              {headline.event.unit ? <span>unit {headline.event.unit}</span> : null}
              <span>M{fmtMag(headline.event.mag)}</span>
              {headline.event.depth !== null ? <span>depth {trimNum(headline.event.depth)} km</span> : <span>depth not in record</span>}
              <span>{headline.ageDays.toFixed(1)} d before harvest snapshot</span>
              <a href={headline.event.url} target="_blank" rel="noreferrer" className="text-sky-300 hover:underline">
                source record ↗
              </a>
            </div>
            <p className="mt-1.5 text-[10px] leading-snug text-amber-300/90">
              Impact panels below are fixed-seed sample values — they do not describe this earthquake, and nothing below is a measurement of it.
            </p>
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/50 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status="not connected" note="no headline" />
              <span className="text-[13px] font-semibold text-slate-200">No qualifying live event in the current harvest</span>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-slate-400">
              The board only headlines an earthquake that is actually present in the loaded dataset:{' '}
              <b className="text-slate-300">type “earthquake”, magnitude present, origin time within the last {HEADLINE_WINDOW_DAYS} days of the snapshot</b>
              . No such record exists right now, so no event is shown — nothing here is representative of a real quake.
            </p>
            {dbError ? <p className="mt-1 text-[10px] text-rose-300">Harvest error: {dbError}</p> : null}
          </div>
        )}
      </Glass>

      {/* --------------------- map + sample indicator grid --------------------- */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        {/* stylized epicentre panel */}
        <Glass className="overflow-hidden p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="h-title">Epicentre view</div>
            <StatusBadge status="sample" note="diagram only" />
          </div>

          <div
            className="relative mt-2 aspect-[16/10] w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950/80"
            style={{
              backgroundImage:
                'linear-gradient(rgba(148,163,184,.10) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.10) 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }}
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: 'radial-gradient(70% 70% at 50% 50%, rgba(244,63,94,.10), rgba(2,6,15,0) 70%)' }}
            />

            {/* concentric rings — toggles change styling only */}
            {LAYER_TOGGLES.map((l) => {
              const on = layers[l.id];
              return (
                <div
                  key={l.id}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                  style={{ width: `${l.sizePct}%` }}
                >
                  <div
                    className={`aspect-square w-full rounded-full border transition-all duration-300 ${on ? RING_ON[l.id] : 'border-slate-600/25 opacity-25'}`}
                    style={{ borderWidth: on ? l.weight : 1 }}
                  />
                </div>
              );
            })}

            {/* crosshair — stylized epicentre */}
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-px w-[64%] -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-transparent via-rose-400/50 to-transparent" />
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-[64%] w-px -translate-x-1/2 -translate-y-1/2 bg-gradient-to-b from-transparent via-rose-400/50 to-transparent" />
            <div
              className={`pointer-events-none absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border ${
                headline ? 'border-rose-300 bg-rose-500/50 shadow-[0_0_18px_rgba(244,63,94,.6)]' : 'border-slate-500 bg-slate-700/60'
              }`}
            />

            <div className="pointer-events-none absolute left-3 top-3 rounded border border-white/10 bg-slate-950/70 px-1.5 py-0.5 font-mono text-[10px] text-slate-300">
              {headline ? headlineCoords(headline) : 'no epicentre'}
            </div>
            <div className="pointer-events-none absolute right-3 top-3 rounded border border-amber-400/30 bg-slate-950/70 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-amber-300/90">
              {MAP_CAPTION}
            </div>
            <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-1">
              <span className="rounded-full border border-white/10 bg-slate-950/80 px-1.5 py-0.5 text-[9px] text-slate-300">
                {LAYER_TOGGLES.filter((l) => layers[l.id]).length} of {LAYER_TOGGLES.length} layers drawn
              </span>
              {LAYER_TOGGLES.every((l) => !layers[l.id]) ? (
                <span className="rounded-full border border-white/10 bg-slate-950/80 px-1.5 py-0.5 text-[9px] text-slate-400">all layers hidden</span>
              ) : null}
            </div>
          </div>

          {/* layer toggles */}
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {LAYER_TOGGLES.map((l) => {
              const on = layers[l.id];
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => toggle(l.id)}
                  aria-pressed={on}
                  className="flex items-start gap-1.5 rounded-lg border border-white/5 bg-white/[.02] px-2 py-1.5 text-left transition hover:border-sky-300/25 hover:bg-white/[.04]"
                >
                  <span
                    aria-hidden="true"
                    className={`mt-[1px] grid h-3.5 w-3.5 shrink-0 place-items-center rounded border text-[9px] font-bold leading-none ${
                      on ? 'border-sky-400/60 bg-sky-500/30 text-sky-100' : 'border-white/25 text-transparent'
                    }`}
                  >
                    {on ? '✓' : ''}
                  </span>
                  <span className="min-w-0">
                    <span className={`flex items-center gap-1 text-[11px] font-medium ${on ? 'text-slate-100' : 'text-slate-400'}`}>
                      <Icon name={l.icon} className="h-3 w-3" />
                      {l.label}
                    </span>
                    <span className="block text-[9px] uppercase tracking-wide text-slate-500">{l.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-[10px] leading-snug text-slate-500">
            Toggles change local styling only — no tile service, raster or catalogue is queried. The panel is a diagram, not a map.
          </p>
        </Glass>

        {/* 2×2 sample indicators */}
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            {SAMPLE_INDICATORS.map((s) => (
              <Glass key={s.id} className="p-3">
                <div className="flex items-start justify-between gap-1.5">
                  <span className="flex items-center gap-1 text-[10px] uppercase leading-tight tracking-wide text-slate-400">
                    <Icon name={s.icon} className="h-3.5 w-3.5 text-slate-400" />
                    {s.label}
                  </span>
                  <SampleBadge />
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-xl font-bold leading-none text-white">{s.value}</span>
                  <span className="text-[10px] text-slate-400">{s.unit}</span>
                </div>
                <div className="mt-1.5 h-1 w-full overflow-hidden rounded bg-white/10">
                  <div className={`h-full rounded ${BAR_TONE[s.id] ?? 'bg-slate-400'}`} style={{ width: `${s.fillPct}%` }} />
                </div>
                <p className="mt-1.5 text-[10px] leading-snug text-slate-500">{s.detail}</p>
              </Glass>
            ))}
          </div>
          <div className="rounded-xl border border-amber-400/25 bg-amber-500/[.07] p-2.5 text-[10px] leading-snug text-amber-200/90">
            <b className="text-amber-200">{SAMPLE_CLAUSE}</b>{' '}
            <span className="text-amber-200/70">These are {SAMPLE_ATTRIBUTION}.</span>
          </div>
        </div>
      </div>

      {/* --------------------- before / after / change --------------------- */}
      <Glass className="p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="h-title">Before / After / Change</div>
          <span className="rounded border border-amber-400/40 bg-amber-500/15 px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wider text-amber-300">
            {THUMB_NOTE}
          </span>
        </div>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {BEFORE_AFTER_THUMBS.map((t) => (
            <div key={t.id}>
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-white/10" style={{ backgroundImage: t.gradient }}>
                <div
                  className="absolute inset-0 opacity-40"
                  style={{
                    backgroundImage:
                      'linear-gradient(rgba(255,255,255,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.07) 1px, transparent 1px)',
                    backgroundSize: '18px 18px',
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
                <span className="absolute left-2 top-2 rounded border border-white/15 bg-slate-950/70 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-200">
                  {t.label}
                </span>
                <span className="absolute bottom-2 right-2 rounded border border-amber-400/40 bg-slate-950/70 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wider text-amber-300">
                  illustrative
                </span>
              </div>
              <p className="mt-1 text-[10px] text-slate-500">{t.caption}</p>
            </div>
          ))}
        </div>
        <p className="mt-1.5 text-[10px] leading-snug text-slate-500">
          CSS-gradient placeholders — no optical or radar imagery is shown, and no acquisition is referenced.
        </p>
      </Glass>

      {/* --------------------- change timeline --------------------- */}
      <Glass className="p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="h-title">Change timeline</div>
          <span className="text-[10px] text-slate-500">real stamps from the headline record · sample rows marked</span>
        </div>
        {timeline.length ? (
          <ul className="scroll-thin mt-2 space-y-1 overflow-y-auto text-[11px]">
            {timeline.map((r) => (
              <li key={r.id} className="flex items-start gap-2 rounded-lg border border-white/5 bg-white/[.02] px-2 py-1.5">
                <span
                  aria-hidden="true"
                  className={`mt-1 h-2 w-2 shrink-0 rounded-full ${r.kind === 'real' ? 'bg-emerald-400' : 'border border-amber-400/70 bg-transparent'}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-slate-100">{r.label}</span>
                    {r.kind === 'sample' ? <SampleBadge /> : null}
                  </span>
                  <span className="block text-[10px] leading-snug text-slate-500">{r.detail}</span>
                </span>
                <span className={`shrink-0 font-mono text-[10px] ${r.kind === 'real' ? 'text-slate-300' : 'text-amber-300/80'}`}>{r.stamp}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[11px] text-slate-500">
            No timeline — the real stamps come from the headline record, and there is no qualifying event in the current harvest.
          </p>
        )}
      </Glass>

      {/* --------------------- provenance --------------------- */}
      <Glass className="p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[10px] uppercase tracking-wide text-slate-400">From Earthdata to Evidence</span>
          <span className="text-[10px] text-slate-500">no SAR/flood/fire step has run in this build — the board stops at Discover</span>
        </div>
        <WorkflowStrip active={0} className="mt-2" />
      </Glass>

      <Provenance
        sources={PROVENANCE_SOURCES}
        coverage={
          db && headline
            ? { start: isoDay(headline.event.t), end: isoDay(db.refTime), label: 'headline origin time → harvest snapshot' }
            : { start: '—', end: db ? isoDay(db.refTime) : '—', label: 'no qualifying event in the current harvest' }
        }
        honesty="sample"
        citation={PROVENANCE_CITATION}
      />
    </div>
  );
}
