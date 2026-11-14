import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NAV_GROUPS, NAV_INDEX, searchNav, type NavItem } from '../data/nav';
import { Icon } from './ui';

const RECENTS_KEY = 'orbit.nav.recents';

function loadRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    const ids = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string').slice(0, 4) : [];
  } catch {
    return [];
  }
}

function remember(id: string) {
  try {
    const next = [id, ...loadRecents().filter((x) => x !== id)].slice(0, 4);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    /* storage disabled — recents are a nicety, never a dependency */
  }
}

const GROUP_LABEL: Record<string, string> = Object.fromEntries(NAV_GROUPS.map((g) => [g.id, g.label]));

/** ⌘K / Ctrl-K palette — the "one smart" entry point over the whole platform. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const recents = useMemo<NavItem[]>(() => {
    if (q.trim()) return [];
    return loadRecents()
      .map((id) => NAV_INDEX.find((i) => i.id === id))
      .filter((i): i is NavItem => Boolean(i));
  }, [q, open]);

  const results = useMemo(() => (q.trim() ? searchNav(q) : recents.length ? recents : NAV_INDEX.slice(0, 8)), [q, recents]);
  const askFallback = q.trim().length > 2 && results.length === 0;
  const rows = results.length + (askFallback ? 1 : 0);

  useEffect(() => {
    if (!open) return;
    setQ('');
    setCursor(0);
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => setCursor(0), [q]);

  const go = useCallback(
    (item?: NavItem) => {
      if (!item) return;
      remember(item.id);
      onClose();
      nav(item.to);
    },
    [nav, onClose],
  );

  const runAsk = useCallback(() => {
    const text = q.trim();
    if (!text) return;
    onClose();
    nav(`/analysis?q=${encodeURIComponent(text)}`);
  }, [q, nav, onClose]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor((c) => (rows ? (c + 1) % rows : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor((c) => (rows ? (c - 1 + rows) % rows : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (askFallback) runAsk();
      else go(results[cursor]);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-space-950/70 px-4 pt-[12vh] backdrop-blur-sm"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search ORBIT"
        className="glass w-full max-w-[620px] overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,.6)]"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <Icon name="Search" className="h-4 w-4 shrink-0 text-sky-300" />
          <input
            ref={inputRef}
            className="w-full bg-transparent text-[15px] text-white placeholder:text-slate-500 outline-none"
            placeholder="Jump to a world, a page, or ask ORBIT…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search destinations"
            aria-controls="orbit-palette-results"
            role="combobox"
            aria-expanded="true"
          />
          <kbd className="shrink-0 rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">esc</kbd>
        </div>

        <div id="orbit-palette-results" role="listbox" className="scroll-thin max-h-[52vh] overflow-y-auto p-2">
          {!q.trim() && (
            <div className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              {recents.length ? 'Recent' : 'Start here'}
            </div>
          )}
          {results.map((item, i) => (
            <button
              key={item.id}
              role="option"
              aria-selected={i === cursor}
              onMouseEnter={() => setCursor(i)}
              onClick={() => go(item)}
              className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition ${i === cursor ? 'bg-gradient-to-r from-sky-500/30 to-indigo-500/10 text-white shadow-glow' : 'text-slate-200 hover:bg-white/5'}`}
            >
              <Icon name={item.icon} className={`h-4 w-4 shrink-0 ${item.color ?? 'text-sky-300'}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">{item.label}</span>
                {item.hint && <span className="block truncate text-[11px] text-slate-400">{item.hint}</span>}
              </span>
              {item.badge && <span className="shrink-0 rounded border border-white/10 bg-white/5 px-1.5 py-[1px] text-[10px] font-semibold text-slate-300">{item.badge}</span>}
              <span className="shrink-0 text-[10px] uppercase tracking-wide text-slate-500">{item.id.startsWith('solution.') ? 'Solutions' : GROUP_LABEL[item.group] ?? ''}</span>
            </button>
          ))}
          {askFallback && (
            <button
              role="option"
              aria-selected={cursor === results.length}
              onMouseEnter={() => setCursor(results.length)}
              onClick={runAsk}
              className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition ${cursor === results.length ? 'bg-gradient-to-r from-sky-500/30 to-indigo-500/10 text-white shadow-glow' : 'text-slate-200 hover:bg-white/5'}`}
            >
              <Icon name="Sparkles" className="h-4 w-4 shrink-0 text-amber-300" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium">Ask ORBIT: “{q.trim()}”</span>
                <span className="block truncate text-[11px] text-slate-400">Plans the question, fetches the data, opens the evidence</span>
              </span>
              <kbd className="shrink-0 rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">↵</kbd>
            </button>
          )}
          {results.length === 0 && !askFallback && (
            <div className="px-3 py-6 text-center text-[12px] text-slate-400">Type at least three characters to ask ORBIT.</div>
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-white/10 px-4 py-2 text-[10px] text-slate-500">
          <span><kbd className="rounded border border-white/10 px-1">↑↓</kbd> move</span>
          <span><kbd className="rounded border border-white/10 px-1">↵</kbd> open</span>
          <span className="ml-auto">Free text runs an analysis</span>
        </div>
      </div>
    </div>
  );
}
