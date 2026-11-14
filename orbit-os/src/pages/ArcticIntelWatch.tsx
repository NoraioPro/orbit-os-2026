import { Link } from 'react-router-dom';

/**
 * Embedded sub-page running the Arctic Intel Watch app (NoraioPro/arctic-intel-watch)
 * as a live iframe. The app is served by its own Vite dev server on :5174.
 */
export default function ArcticIntelWatch() {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/module/gnss" className="text-xs font-medium text-sky-300 hover:underline">← Back to GNSS Guardian</Link>
          <span className="text-slate-600">|</span>
          <span className="h-title">Arctic Intel Watch</span>
          <span className="rounded border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">live · :5174</span>
        </div>
        <a href="http://localhost:5174/" target="_blank" rel="noreferrer" className="text-xs text-sky-300 hover:underline">Open in new tab ↗</a>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-700/60">
        <iframe
          src="http://localhost:5174/"
          title="Arctic Intel Watch — maritime threat detection"
          className="h-[calc(100vh-10rem)] w-full border-0 bg-slate-900"
        />
      </div>
    </div>
  );
}
