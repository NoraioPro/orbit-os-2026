interface ProvenanceSource {
  name: string;
  url?: string;
  note?: string;
}

interface ProvenanceProps {
  sources: ProvenanceSource[];
  coverage: { start: string; end: string; label?: string };
  citation?: string;
  honesty?: 'live' | 'snapshot' | 'sample';
  download?: { label: string; onClick: () => void };
  className?: string;
}

/**
 * Reusable provenance strip shown on every module/page:
 * sources + coverage date range + citation + honesty label.
 * "From Earthdata to Evidence" — every number traces to a source and a window.
 */
export function Provenance({ sources, coverage, citation, honesty = 'sample', download, className = '' }: ProvenanceProps) {
  const honestyStyle =
    honesty === 'live'
      ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300'
      : honesty === 'snapshot'
        ? 'border-sky-400/30 bg-sky-500/10 text-sky-300'
        : 'border-amber-400/30 bg-amber-500/10 text-amber-300';

  return (
    <div className={`rounded-xl border border-white/10 bg-slate-950/50 p-3 text-[11px] ${className}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${honestyStyle}`}>
          Provenance · {honesty}
        </span>
        <span className="text-slate-400">
          Coverage: <b className="text-slate-200">{coverage.start} → {coverage.end}</b>
          {coverage.label ? <span className="text-slate-500"> ({coverage.label})</span> : null}
        </span>
        {download ? (
          <button onClick={download.onClick} className="ml-auto text-sky-300 hover:underline">⤓ {download.label}</button>
        ) : null}
      </div>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-slate-500">
        <span className="font-semibold uppercase tracking-wide text-slate-400">Sources</span>
        {sources.map((s, i) => (
          <span key={i} className="whitespace-nowrap">
            {s.url ? (
              <a href={s.url} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">{s.name} ↗</a>
            ) : (
              <span className="text-slate-300">{s.name}</span>
            )}
            {s.note ? <span className="text-slate-500"> ({s.note})</span> : null}
          </span>
        ))}
      </div>
      {citation ? <div className="mt-1 text-slate-500">Cite: {citation}</div> : null}
    </div>
  );
}
