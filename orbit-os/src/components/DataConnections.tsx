import { CONNECTORS } from '../data/connectors';

/**
 * Settings panel: every data source with its real status (connected-live vs
 * needs-credentials), date range for live sources, and an honest "needs X"
 * for everything not yet connected. No fabricated numbers.
 */
export function DataConnections() {
  const connected = CONNECTORS.filter((c) => c.status === 'connected');
  const needsCreds = CONNECTORS.filter((c) => c.status === 'needs-credentials');

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-bold text-white">Data connections</span>
        <span className="text-emerald-300">{connected.length} connected · live</span>
        <span className="text-amber-300">{needsCreds.length} need credentials</span>
      </div>

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
        {CONNECTORS.map((c) => (
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
    </div>
  );
}
