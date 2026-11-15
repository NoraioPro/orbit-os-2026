import { Link } from 'react-router-dom';
import { SvalbardIceWatch } from '../modules/SvalbardIceWatch';

/**
 * Arctic Watch.
 *
 * Top: the real ice data — MET Norway's SIGRID-3 chart parsed into polygons plus
 * NSIDC's regional ice-area record — because that is the part that can be shown
 * with citable numbers.
 *
 * Below: the Arctic Intel Watch prototype (NoraioPro/arctic-intel-watch), served by
 * its own Vite dev server on :5174 and embedded unchanged, kept clearly separate
 * from the published ice data rather than blended into it.
 */
export default function ArcticIntelWatch() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/module/gnss" className="text-xs font-medium text-sky-300 hover:underline">← Back to GNSS Guardian</Link>
          <span className="text-slate-600">|</span>
          <span className="h-title">Arctic Watch</span>
          <span className="rounded border border-sky-400/40 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-300">real data · MET Norway + NSIDC</span>
        </div>
        <a href="https://cryo.met.no/en/latest-ice-charts" target="_blank" rel="noreferrer" className="text-xs text-sky-300 hover:underline">
          cryo.met.no ↗
        </a>
      </div>

      <SvalbardIceWatch />

      <div className="pt-2">
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <div>
            <div className="text-[12px] font-semibold text-white">Arctic Intel Watch · prototype</div>
            <div className="text-[10px] text-slate-400">
              Separate app by NoraioPro, embedded unchanged from its own dev server — kept apart from the published ice data above.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">live · :5174</span>
            <a href="http://localhost:5174/" target="_blank" rel="noreferrer" className="text-xs text-sky-300 hover:underline">Open in new tab ↗</a>
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-700/60">
          <iframe
            src="http://localhost:5174/"
            title="Arctic Intel Watch — maritime threat detection"
            className="h-[80vh] w-full border-0 bg-slate-900"
          />
        </div>
      </div>
    </div>
  );
}
