import { useEffect, useState } from 'react';
import { CONNECTORS } from '../data/connectors';

type ServerStatus = Record<string, { configured: boolean; keyless?: boolean; note: string }>;

/** Maps a UI connector id to the server proxy's status key. */
const SERVER_KEY: Record<string, string> = {
  earthdata: 'earthdata',
  asf: 'asf',
  nisar: 'earthdata',
  'copernicus-stac': 'cdse',
  'sentinel-hub': 'sentinelHub',
  hyp3: 'earthdata',
  opentopography: 'opentopography',
};

/**
 * Settings panel: every data source with its REAL status. It fetches
 * /api/connector/status — credentials live server-side only, so the browser
 * sees "configured / not configured", never a secret.
 */
export function DataConnections() {
  const [server, setServer] = useState<ServerStatus | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/connector/status')
      .then((r) => (r.ok ? r.json() : {}))
      .then((d: ServerStatus) => { if (alive) setServer(d); })
      .catch(() => { if (alive) setServer({}); });
    return () => { alive = false; };
  }, []);

  const connectors = CONNECTORS.map((c) => {
    const key = SERVER_KEY[c.id];
    const s = key && server ? server[key] : null;
    if (!s) return c;
    if (s.configured) {
      return { ...c, status: 'connected' as const, dateRange: s.keyless ? 'keyless · live' : 'authenticated · live' };
    }
    return { ...c, status: 'needs-credentials' as const, auth: s.note };
  });

  const connected = connectors.filter((c) => c.status === 'connected');
  const needsCreds = connectors.filter((c) => c.status === 'needs-credentials');

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-bold text-white">Data connections</span>
        <span className="text-emerald-300">{connected.length} connected · live</span>
        <span className="text-amber-300">{needsCreds.length} need credentials</span>
        {server ? null : <span className="text-xs text-slate-500">checking server…</span>}
      </div>

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        {connectors.map((c) => (
          <div
            key={c.id}
            className={`rounded-lg border p-3 ${
              c.status === 'connected'
                ? 'border-emerald-400/30 bg-emerald-500/5'
                : 'border-amber-400/20 bg-amber-500/5'
            }`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                  c.priority === 'P0' ? 'bg-rose-500/15 text-rose-300' : 'bg-sky-500/15 text-sky-300'
                }`}
              >
                {c.priority}
              </span>
              <span className="text-sm font-semibold text-white">{c.name}</span>
              <span className="ml-auto flex items-center gap-1 whitespace-nowrap text-[10px]">
                {c.status === 'connected' ? (
                  <span className="text-emerald-300">● live</span>
                ) : (
                  <span className="text-amber-300">● not connected</span>
                )}
              </span>
            </div>

            <div className="mt-0.5 text-xs text-slate-400">
              {c.purpose} · {c.provider}
            </div>

            {c.status === 'connected' ? (
              <div className="mt-1.5 text-[10px] text-slate-500">
                Real data · {c.dateRange} ·{' '}
                <a href={c.url} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">
                  source ↗
                </a>
              </div>
            ) : (
              <div className="mt-1.5 text-[10px] text-amber-300/80">
                Missing data — needs {c.auth}.{' '}
                <a href={c.url} target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">
                  get credentials ↗
                </a>
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="text-[10px] text-slate-500">
        🔒 Credentials live only in the dev server&apos;s <code className="rounded bg-white/5 px-1">.env</code> (server-side). The browser calls{' '}
        <code className="rounded bg-white/5 px-1">/api/connector/*</code> and never sees a secret.
      </p>
    </div>
  );
}
