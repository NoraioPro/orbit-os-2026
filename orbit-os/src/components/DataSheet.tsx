import { useEffect, useState } from 'react';
import { Icon } from './ui';

/**
 * One dataset, four ways to look at it: the numbers as cards, as a table, as the
 * raw JSON the app actually loaded, and as a CSV you can take away. Used so a
 * figure on a board is never a dead end — the same value can be read, compared or
 * exported without leaving the page.
 */

export type Mode = 'table' | 'json';

export function useDataSheet(jsonUrl?: string) {
  const [open, setOpen] = useState<Mode | null>(null);
  const [raw, setRaw] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open !== 'json' || !jsonUrl || raw) return;
    let alive = true;
    fetch(jsonUrl)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((t) => alive && setRaw(t))
      .catch((e: Error) => alive && setErr(e.message));
    return () => {
      alive = false;
    };
  }, [open, jsonUrl, raw]);

  return { open, setOpen, raw, err };
}

export function csvFrom(head: string[], body: (string | number | null)[][]) {
  const q = (v: string | number | null) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [head.map(q).join(','), ...body.map((r) => r.map(q).join(','))].join('\n');
}

export function downloadText(name: string, text: string) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function ViewSwitch({
  open,
  setOpen,
  jsonUrl,
  csv,
  csvName,
  extra,
}: {
  open: Mode | null;
  setOpen: (m: Mode | null) => void;
  jsonUrl?: string;
  csv?: { head: string[]; body: (string | number | null)[][] };
  csvName?: string;
  extra?: React.ReactNode;
}) {
  const btn = (label: string, active: boolean, onClick: () => void, disabled = false) => (
    <button
      key={label}
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded border px-1.5 py-0.5 text-[9px] transition ${
        active ? 'border-sky-400/50 bg-sky-500/15 text-sky-200' : disabled ? 'border-white/5 text-slate-600' : 'border-white/10 text-slate-300 hover:border-white/25'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-1">
      {extra}
      {btn('table', open === 'table', () => setOpen(open === 'table' ? null : 'table'))}
      {btn('raw JSON', open === 'json', () => setOpen(open === 'json' ? null : 'json'), !jsonUrl)}
      {csv && btn('CSV ⭳', false, () => downloadText(csvName ?? 'orbit-data.csv', csvFrom(csv.head, csv.body)))}
      {jsonUrl && (
        <a href={jsonUrl} target="_blank" rel="noreferrer" className="rounded border border-white/10 px-1.5 py-0.5 text-[9px] text-slate-300 hover:border-white/25" title={jsonUrl}>
          open ↗
        </a>
      )}
    </div>
  );
}

export function Table({ head, body }: { head: string[]; body: (string | number | null)[][] }) {
  return (
    <div className="mt-1.5 overflow-x-auto rounded border border-white/10">
      <table className="w-full text-[10px]">
        <thead>
          <tr className="bg-white/[0.04] text-left text-slate-400">
            {head.map((h) => (
              <th key={h} className="px-1.5 py-1 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((r, i) => (
            <tr key={i} className="border-t border-white/5 text-slate-300">
              {r.map((c, k) => (
                <td key={k} className={`px-1.5 py-0.5 ${k === 0 ? 'text-slate-200' : 'font-mono text-right text-slate-300'}`}>
                  {c ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function JsonPane({ raw, err, url }: { raw: string | null; err: string | null; url?: string }) {
  const [copied, setCopied] = useState(false);
  if (err) return <div className="mt-1.5 rounded border border-amber-400/30 bg-amber-500/10 p-2 text-[10px] text-amber-200">raw fetch failed: {err}</div>;
  if (!raw) return <div className="mt-1.5 text-[10px] text-slate-500">loading raw JSON…</div>;
  return (
    <div className="mt-1.5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] text-slate-500">{url}</span>
        <button
          type="button"
          className="flex items-center gap-1 text-[9px] text-sky-400 hover:underline"
          onClick={() => {
            void navigator.clipboard?.writeText(raw);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }}
        >
          <Icon name="Copy" className="h-3 w-3" />
          {copied ? 'copied' : 'copy'}
        </button>
      </div>
      <pre className="scroll-thin mt-1 max-h-[240px] overflow-auto rounded border border-white/10 bg-slate-950/70 p-2 font-mono text-[9px] leading-relaxed text-slate-300">
        {raw.slice(0, 20000)}
      </pre>
    </div>
  );
}
