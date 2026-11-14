import { useState } from 'react';
import { DATASETS } from '../data/datasets';
import { Icon } from './ui';

const statusDot: Record<string, string> = {
  live: 'bg-emerald-400',
  snapshot: 'bg-sky-400',
  sample: 'bg-amber-400',
  'not connected': 'bg-slate-600',
};

/** Global footer: every page/module surfaces its data sources + date ranges. */
export function DataFooter() {
  const [open, setOpen] = useState(false);
  const live = DATASETS.filter((d) => d.status === 'live');
  const snapshot = DATASETS.filter((d) => d.status === 'snapshot');
  const sample = DATASETS.filter((d) => d.status === 'sample');
  const planned = DATASETS.filter((d) => d.connection === 'planned');

  return (
    <footer className="relative z-10 shrink-0 border-t border-white/10 bg-slate-950/70 backdrop-blur-sm">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 px-4 py-2 text-[11px] text-slate-400 transition hover:text-slate-200"
      >
        <Icon name="Database" className="h-3.5 w-3.5 text-sky-300" />
        <span className="font-bold uppercase tracking-wider text-slate-300">Data sources &amp; coverage</span>
        <span className="tabular-nums">
          {live.length} live · {snapshot.length} snapshot · {sample.length} sample · {planned.length} planned
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-sky-300">
          <span className="hidden sm:inline">coverage 2001 → 14 Nov 2026</span>
          <span className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▾</span>
        </span>
      </button>
      {open && (
        <div className="grid grid-cols-1 gap-x-8 gap-y-1.5 border-t border-white/5 px-4 py-3 sm:grid-cols-2 xl:grid-cols-3">
          {DATASETS.map((d) => (
            <div key={d.id} className="flex items-start gap-2 text-[10px] leading-snug">
              <span
                className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${statusDot[d.status] ?? 'bg-slate-600'}`}
                title={d.status}
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-1.5">
                  <span className="font-semibold text-slate-200">{d.name}</span>
                  <span className="text-slate-500">· {d.provider}</span>
                  {d.url ? (
                    <a href={d.url} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline" title="Open source ↗">
                      ↗
                    </a>
                  ) : null}
                </div>
                <div className="text-slate-500">{d.note}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </footer>
  );
}
