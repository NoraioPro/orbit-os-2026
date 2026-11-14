const STEPS = ['Discover', 'Access', 'Process', 'Analyze', 'Evidence'] as const;

/**
 * The "From Earthdata to Evidence" pipeline: Discover → Access → Process →
 * Analyze → Evidence. `active` = the current step index (0-based).
 */
export function WorkflowStrip({ active = 0, className = '' }: { active?: number; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {STEPS.map((s, i) => {
        const state = i < active ? 'done' : i === active ? 'active' : 'idle';
        const cls =
          state === 'done'
            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30'
            : state === 'active'
              ? 'bg-sky-500/20 text-sky-100 border-sky-400/50 ring-1 ring-sky-400/40'
              : 'bg-white/5 text-slate-500 border-white/10';
        return (
          <div key={s} className="flex items-center gap-1">
            <span className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${cls}`}>
              {state === 'done' ? '✓ ' : ''}{i + 1}. {s}
            </span>
            {i < STEPS.length - 1 ? <span className="text-slate-600">→</span> : null}
          </div>
        );
      })}
    </div>
  );
}
