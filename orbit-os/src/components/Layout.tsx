import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { MODULES } from '../data/modules';
import { NAV_GROUPS, matchNav, type NavGroupId } from '../data/nav';
import { useStore } from '../state/store';
import { EvidenceDrawer } from './EvidenceDrawer';
import { DataFooter } from './DataFooter';
import { Logo3D } from './Logo3D';
import { CommandPalette } from './CommandPalette';
import { Icon } from './ui';

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Logo3D size={compact ? 34 : 40} />
      {!compact && (
        <div className="leading-tight">
          <div className="text-[22px] font-extrabold tracking-wide text-white">ORBIT OS</div>
          <div className="text-[11px] text-slate-300">Space Intelligence Platform</div>
        </div>
      )}
    </div>
  );
}

const GROUPS_KEY = 'orbit.nav.groups';
const RAIL_KEY = 'orbit.nav.rail';
const GROUP_DEFAULTS: Record<string, boolean> = { command: true, worlds: true, intelligence: true, program: false, system: false };

function loadGroups(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(GROUPS_KEY);
    if (!raw) return GROUP_DEFAULTS;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(NAV_GROUPS.map((g) => [g.id, parsed[g.id] === undefined ? GROUP_DEFAULTS[g.id] : Boolean(parsed[g.id])]));
  } catch {
    return GROUP_DEFAULTS;
  }
}

/** The single navigation spine — rendered by the desktop rail and by the mobile drawer. */
function Spine({ rail, onToggleRail, onNavigate }: { rail: boolean; onToggleRail?: () => void; onNavigate?: () => void }) {
  const loc = useLocation();
  const [open, setOpen] = useState<Record<string, boolean>>(loadGroups);
  const navRef = useRef<HTMLElement>(null);
  const current = matchNav(loc.pathname);

  // keep the active row (including a 14-deep challenge subtree) in view
  useEffect(() => {
    const active = navRef.current?.querySelector('[aria-current="page"]');
    active?.scrollIntoView({ block: 'nearest' });
  }, [loc.pathname, open]);

  useEffect(() => {
    try {
      localStorage.setItem(GROUPS_KEY, JSON.stringify(open));
    } catch {
      /* storage disabled — the spine still works, it just forgets */
    }
  }, [open]);

  // the group that holds the current page is always expanded
  const isOpen = (id: NavGroupId) => current.group?.id === id || open[id] !== false;
  const toggle = (id: NavGroupId) => setOpen((s) => ({ ...s, [id]: !isOpen(id) }));

  return (
    <nav ref={navRef} aria-label="ORBIT navigation" className="flex min-h-0 flex-1 flex-col">
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto pr-0.5">
        {NAV_GROUPS.map((g) => {
          const expanded = isOpen(g.id);
          return (
            <div key={g.id} className="mb-1">
              <button
                onClick={() => toggle(g.id)}
                aria-expanded={expanded}
                title={rail ? `${g.label} — ${g.hint}` : undefined}
                className={`group flex w-full items-center gap-2 rounded-lg px-2.5 py-1 text-left transition hover:bg-white/5 ${rail ? 'justify-center' : ''}`}
              >
                {rail ? (
                  <span className="grid h-6 w-6 place-items-center rounded-md border border-white/10 bg-white/5 text-[10px] font-bold text-slate-300">{g.items.length}</span>
                ) : (
                  <>
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 group-hover:text-slate-200">{g.label}</span>
                    <span className="min-w-0 truncate text-[10px] text-slate-400">{g.hint}</span>
                    <Icon name="ChevronDown" className={`h-3.5 w-3.5 shrink-0 text-slate-500 transition-transform ${expanded ? '' : '-rotate-90'}`} />
                  </>
                )}
              </button>

              <div className="grid transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}>
                <div className="min-h-0 overflow-hidden">
                  <div className="space-y-[2px] pb-0.5">
                    {g.items.map((item) => {
                      const kids = item.children ?? [];
                      const kidActive = kids.some((k) => k.to === loc.pathname.replace(/\/+$/, '') || loc.pathname.startsWith(`${k.to}/`));
                      const kidsOpen = kidActive || open[item.id] === true;
                      return (
                        <div key={item.id}>
                          <div className="flex items-center gap-1">
                            <NavLink
                              to={item.to}
                              end
                              onClick={onNavigate}
                              title={rail ? `${item.label}${item.badge ? ` · ${item.badge}` : ''}` : item.hint}
                              className={({ isActive }) =>
                                `flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2.5 py-[4px] text-[12.5px] transition ${rail ? 'justify-center' : ''} ${
                                  isActive
                                    ? 'border border-sky-400/40 bg-gradient-to-r from-sky-500/30 to-indigo-500/10 text-white shadow-glow'
                                    : 'border border-transparent text-slate-200 hover:bg-white/5'
                                }`
                              }
                            >
                              <Icon name={item.icon} className={`h-4 w-4 shrink-0 ${item.color ?? 'text-sky-300'}`} />
                              {!rail && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
                              {!rail && kids.length > 0 && (
                                <span className="shrink-0 rounded border border-white/10 bg-white/5 px-1 py-[1px] text-[9px] font-semibold text-slate-400">{kids.length}</span>
                              )}
                              {!rail && item.badge && !kids.length && (
                                <span className="shrink-0 rounded border border-white/10 bg-white/5 px-1 py-[1px] text-[9px] font-semibold tracking-wide text-slate-400">{item.badge}</span>
                              )}
                            </NavLink>
                            {!rail && kids.length > 0 && (
                              <button
                                onClick={() => setOpen((s) => ({ ...s, [item.id]: !kidsOpen }))}
                                aria-expanded={kidsOpen}
                                aria-label={`${kidsOpen ? 'Collapse' : 'Expand'} ${item.label}`}
                                className="rounded-md p-1 text-slate-500 transition hover:bg-white/5 hover:text-white"
                              >
                                <Icon name="ChevronDown" className={`h-3.5 w-3.5 transition-transform ${kidsOpen ? '' : '-rotate-90'}`} />
                              </button>
                            )}
                          </div>

                          {kids.length > 0 && !rail && (
                            <div className="grid transition-[grid-template-rows] duration-300 ease-out" style={{ gridTemplateRows: kidsOpen ? '1fr' : '0fr' }}>
                              <div className="min-h-0 overflow-hidden">
                                <div className="scroll-thin ml-3 mt-0.5 max-h-[42vh] space-y-[2px] overflow-y-auto border-l border-white/10 pl-2 pr-1">
                                  {kids.map((kid) => (
                                    <NavLink
                                      key={kid.id}
                                      to={kid.to}
                                      end
                                      onClick={onNavigate}
                                      title={kid.hint}
                                      className={({ isActive }) =>
                                        `flex items-center gap-2 rounded-lg px-2 py-[3px] text-[12px] transition ${
                                          isActive
                                            ? 'border border-sky-400/30 bg-sky-500/15 text-white'
                                            : 'border border-transparent text-slate-300 hover:bg-white/5 hover:text-white'
                                        }`
                                      }
                                    >
                                      <Icon name={kid.icon} className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                      <span className="min-w-0 flex-1 truncate">{kid.label}</span>
                                      {kid.badge && <span className="shrink-0 text-[9px] font-semibold text-slate-500">{kid.badge}</span>}
                                    </NavLink>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {onToggleRail && (
        <button
          onClick={onToggleRail}
          title={rail ? 'Expand navigation' : 'Collapse to icons'}
          className="mt-1 flex items-center justify-center gap-2 rounded-lg border border-white/10 px-2 py-1 text-[11px] text-slate-400 transition hover:border-sky-300/40 hover:text-white"
        >
          <Icon name={rail ? 'ChevronsRight' : 'ChevronsLeft'} className="h-3.5 w-3.5" />
          {!rail && 'Collapse'}
        </button>
      )}
    </nav>
  );
}

function TopBar({ onOpenPalette, onOpenDrawer }: { onOpenPalette: () => void; onOpenDrawer: () => void }) {
  const nav = useNavigate();
  const loc = useLocation();
  const { reviews, db } = useStore();
  const current = matchNav(loc.pathname);
  const moduleId = current.item?.kind === 'module' ? current.item.to.split('/').pop() : undefined;
  const mod = moduleId ? MODULES.find((m) => m.id === moduleId) : undefined;
  const pending = db ? Math.max(0, db.flags.length - Object.values(reviews).filter((r) => r.id.startsWith('flag:') && r.state !== 'pending').length) : 0;

  return (
    <header className="relative z-20 flex items-center gap-4 px-4 pt-3">
      <NavLink to="/" className="shrink-0 transition hover:brightness-125" aria-label="ORBIT OS — Command Center">
        <Logo />
      </NavLink>

      <div className="hidden min-w-0 items-center gap-2 md:flex">
        <span className="h-5 w-px bg-white/10" />
        <span className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">{current.group?.label ?? 'ORBIT'}</span>
        <Icon name="ChevronRight" className="h-3.5 w-3.5 shrink-0 text-slate-600" />
        <span className="truncate text-[13px] font-medium text-white">{current.item?.label ?? 'Command Center'}</span>
        {mod && (
          <>
            <span className="shrink-0 rounded border border-white/10 bg-white/5 px-1.5 py-[1px] text-[10px] font-semibold text-slate-300">{mod.release}</span>
            <span
              title={mod.honest}
              className={`shrink-0 rounded border px-1.5 py-[1px] text-[10px] font-semibold uppercase ${mod.state === 'demo' ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300' : 'border-amber-400/30 bg-amber-500/10 text-amber-300'}`}
            >
              {mod.state}
            </span>
          </>
        )}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={onOpenPalette}
          className="flex items-center gap-2 rounded-xl border border-sky-300/20 bg-slate-950/50 px-3 py-1.5 text-[12px] text-slate-400 transition hover:border-sky-300/50 hover:text-white"
          aria-label="Search or ask ORBIT (Control K)"
        >
          <Icon name="Search" className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Search or ask ORBIT…</span>
          <kbd className="hidden rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400 sm:inline">⌘K</kbd>
        </button>

        <button
          aria-label={`${pending} flags awaiting review`}
          title={`${pending} anomaly flags awaiting human review`}
          onClick={() => nav('/module/disaster')}
          className="relative rounded-full p-2 transition hover:bg-white/5 active:scale-95"
        >
          <Icon name="Bell" className="h-5 w-5 text-slate-200" />
          {pending > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold">{pending}</span>}
        </button>

        <button onClick={onOpenDrawer} aria-label="Open navigation" className="rounded-lg border border-white/10 p-2 text-slate-200 md:hidden">
          <Icon name="Menu" className="h-5 w-5" />
        </button>

        <div className="grid h-9 w-9 place-items-center rounded-full border-2 border-sky-400/60 bg-gradient-to-br from-indigo-500 to-sky-600 text-[12px] font-bold shadow-glow" title="Hassan Nasr">HN</div>
      </div>
    </header>
  );
}

export function OsloClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  const d = now.toLocaleDateString('en-US', { timeZone: 'Europe/Oslo', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const t = now.toLocaleTimeString('en-GB', { timeZone: 'Europe/Oslo', hour: '2-digit', minute: '2-digit' });
  const tz = now.toLocaleTimeString('en-US', { timeZone: 'Europe/Oslo', timeZoneName: 'short' }).split(' ').pop();
  return <div className="flex items-center gap-4 text-sm text-slate-200"><span>{d}</span><span>Oslo ({tz === 'GMT+1' ? 'CET' : tz === 'GMT+2' ? 'CEST' : tz})</span><span className="text-lg font-semibold text-white">{t}</span></div>;
}

export function LiveBadge() {
  const { live, settings } = useStore();
  if (live === null) return <span className="rounded-full border border-slate-500/30 px-3 py-1 text-xs text-slate-400">Checking…</span>;
  return live
    ? <span title="Keyless NASA/USGS APIs reachable. Live figures are marked LIVE; the rest stay snapshot or sample." className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300"><span className="live-dot h-2 w-2 rounded-full bg-emerald-400" />Live</span>
    : <span title={settings.preferLive ? 'Live APIs unreachable: offline snapshot mode' : 'Live mode is off in Settings'} className="inline-flex items-center gap-2 rounded-full border border-sky-400/40 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-300"><span className="h-2 w-2 rounded-full bg-sky-400" />Snapshot mode</span>;
}

export function Layout() {
  const loc = useLocation();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [rail, setRail] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(RAIL_KEY);
      if (stored !== null) return stored === '1';
    } catch {
      /* storage disabled */
    }
    return typeof window !== 'undefined' ? window.innerWidth < 1280 : false;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // any navigation closes the mobile drawer
  useEffect(() => setDrawer(false), [loc.pathname]);

  const toggleRail = () => {
    setRail((v) => {
      try {
        localStorage.setItem(RAIL_KEY, v ? '0' : '1');
      } catch {
        /* storage disabled */
      }
      return !v;
    });
  };

  return (
    <div className="stars flex h-full min-h-screen flex-col">
      <TopBar onOpenPalette={() => setPaletteOpen(true)} onOpenDrawer={() => setDrawer(true)} />
      <div className="relative z-10 flex min-h-0 flex-1 gap-3 p-3 pt-2">
        <aside className={`glass relative z-10 hidden shrink-0 flex-col overflow-hidden p-3 transition-[width] duration-300 md:flex ${rail ? 'w-[68px]' : 'w-[248px]'}`}>
          <Spine rail={rail} onToggleRail={toggleRail} />
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-72 rounded-full bg-[radial-gradient(circle_at_50%_30%,rgba(56,189,248,.35),rgba(30,64,175,.22)_40%,transparent_70%)] blur-[2px]" />
        </aside>

        {drawer && (
          <div className="fixed inset-0 z-40 flex md:hidden" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setDrawer(false); }}>
            <div className="absolute inset-0 bg-space-950/70 backdrop-blur-sm" />
            <aside className="glass relative z-10 m-3 flex w-[260px] flex-col overflow-hidden p-3">
              <div className="mb-2 flex items-center justify-between">
                <Logo compact />
                <button onClick={() => setDrawer(false)} aria-label="Close navigation" className="rounded-lg p-1.5 text-slate-300 hover:bg-white/5">
                  <Icon name="X" className="h-4 w-4" />
                </button>
              </div>
              <Spine rail={false} onNavigate={() => setDrawer(false)} />
            </aside>
          </div>
        )}

        <main className="glass relative min-w-0 flex-1 overflow-hidden">
          <div key={loc.pathname} className="page-in scroll-thin h-full overflow-y-auto p-5"><Outlet /></div>
        </main>
      </div>
      <DataFooter />
      <EvidenceDrawer />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
