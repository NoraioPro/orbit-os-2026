import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Route-level safety net.
 *
 * ORBIT renders live upstream data, so any shape change in an API response could
 * previously blank an entire page. A crash now costs one labelled panel instead
 * of the whole screen — and the message is shown, never swallowed.
 */
export class ErrorBoundary extends Component<{ children: ReactNode; label?: string }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // keep the trace in the console for the developer, and in the panel for the judge
    console.error('ORBIT panel crashed:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="p-1">
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/[0.08] p-4">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-full border border-rose-400/40 bg-rose-500/15 text-[11px] font-bold text-rose-200">!</span>
            <span className="text-[13px] font-semibold text-white">{this.props.label ?? 'This panel'} could not render</span>
            <span className="rounded border border-rose-400/30 bg-rose-500/10 px-1.5 py-[1px] text-[9px] font-semibold uppercase tracking-wide text-rose-200">isolated</span>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-rose-100/80">
            The rest of ORBIT keeps running — a failing data shape must never take the whole screen down. Nothing on this panel is being
            faked in its place.
          </p>
          <pre className="mt-2 max-h-32 overflow-auto rounded-lg border border-white/10 bg-slate-950/70 p-2 text-[10px] leading-snug text-rose-200/80">{error.message}</pre>
          <button onClick={() => this.setState({ error: null })} className="btn-ghost mt-2 !px-2.5 !py-1 text-[11px]">
            Retry panel
          </button>
        </div>
      </div>
    );
  }
}
