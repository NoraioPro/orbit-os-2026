import { useEffect, useState } from 'react';
import { Glass, StatusBadge } from './ui';

interface NisarScene {
  sceneName: string;
  startTime?: string;
  absoluteOrbit?: number;
  flightDirection?: string;
  polarization?: string[];
  browse?: string[];
}

/**
 * Real NISAR acquisitions pulled live from the NASA ASF Search API (keyless)
 * through the secure server proxy. This is genuine scene metadata — orbit,
 * flight direction, polarisation and a browse thumbnail — not a template.
 */
export function RealNisar() {
  const [scenes, setScenes] = useState<NisarScene[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    fetch('/api/connector/asf/services/search/param?platform=NISAR&output=json&maxResults=6', { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: NisarScene[][]) => { if (alive) setScenes(d?.[0] ?? []); })
      .catch((e) => { if (alive) setErr(String(e?.message || e)); })
      .finally(() => clearTimeout(timer));
    return () => { alive = false; ctrl.abort(); clearTimeout(timer); };
  }, []);

  return (
    <Glass className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="h-title">Real NISAR acquisitions — ASF Search API</div>
        <StatusBadge status="live" note="keyless · NASA ASF" />
      </div>
      <p className="mt-1 text-xs text-slate-400">
        Live scene metadata from NASA ASF (keyless, through the server proxy). Genuine NISAR acquisitions — orbit, direction and polarisation — not a template.
      </p>

      {err ? <div className="mt-2 rounded border border-rose-400/30 bg-rose-500/10 p-2 text-xs text-rose-200">ASF unavailable: {err}</div> : null}
      {!scenes && !err ? <div className="mt-2 text-xs text-slate-500">Loading real NISAR scenes…</div> : null}
      {scenes && scenes.length === 0 ? <div className="mt-2 text-xs text-slate-500">No NISAR scenes returned today.</div> : null}

      {scenes && scenes.length > 0 ? (
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {scenes.map((s) => (
            <div key={s.sceneName} className="rounded-lg border border-white/10 bg-white/5 p-2 text-[10px]">
              {s.browse?.[0] ? (
                <img
                  src={s.browse[0]}
                  alt="NISAR browse"
                  className="mb-1 h-20 w-full rounded object-cover"
                  loading="lazy"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
              ) : null}
              <div className="truncate font-semibold text-slate-200" title={s.sceneName}>{s.sceneName.replace(/^NISAR_L1_PR_RSLC_/, 'NISAR ')}</div>
              <div className="text-slate-500">
                orbit {s.absoluteOrbit ?? '—'} · {s.flightDirection ?? '—'} · {s.polarization?.join('+') ?? '—'}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </Glass>
  );
}
