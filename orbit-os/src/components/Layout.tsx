import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAssets } from '../data/assets';
import { MODULES } from '../data/modules';
import { useStore } from '../state/store';
import { EvidenceDrawer } from './EvidenceDrawer';
import { Icon } from './ui';

export function Logo() {
  const a = useAssets();
  return (
    <div className="flex items-center gap-3">
      {a.logo ? <img src={a.logo} alt="ORBIT OS logo" className="h-11 w-11 rounded-full object-contain drop-shadow-[0_0_12px_rgba(139,92,246,.6)]" /> : <svg viewBox="0 0 64 64" className="h-11 w-11 drop-shadow-[0_0_12px_rgba(139,92,246,.6)]">
        <defs>
          <radialGradient id="lg1" cx=".35" cy=".35"><stop offset="0" stopColor="#7dd3fc" /><stop offset=".6" stopColor="#4f46e5" /><stop offset="1" stopColor="#1e1b4b" /></radialGradient>
          <linearGradient id="lg2" x1="0" x2="1"><stop offset="0" stopColor="#f97316" /><stop offset=".5" stopColor="#ec4899" /><stop offset="1" stopColor="#8b5cf6" /></linearGradient>
        </defs>
        <circle cx="32" cy="32" r="15" fill="url(#lg1)" />
        <ellipse cx="32" cy="32" rx="29" ry="11" fill="none" stroke="url(#lg2)" strokeWidth="4" transform="rotate(-28 32 32)" />
        <circle cx="55" cy="20" r="3" fill="#fde68a" />
      </svg>}
      <div className="leading-tight">
        <div className="text-[26px] font-extrabold tracking-wide text-white">ORBIT OS</div>
        <div className="text-[12px] text-slate-300">Space Intelligence Platform</div>
      </div>
    </div>
  );
}

const TOP = [
  { to: '/', label: 'Command Center', icon: 'Orbit' },
  { to: '/explore', label: 'Explore', icon: 'Compass' },
  { to: '/analysis', label: 'Analysis', icon: 'ChartColumn' },
  { to: '/missions', label: 'Missions', icon: 'Rocket' },
  { to: '/solutions', label: 'Solutions', icon: 'Puzzle' },
  { to: '/sdgs', label: 'SDGs', icon: 'Target' },
  { to: '/reports', label: 'Reports', icon: 'FileText' },
];

function TopNav() {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const { reviews, db } = useStore();
  const pending = db ? Math.max(0, db.flags.length - Object.values(reviews).filter((r) => r.id.startsWith('flag:') && r.state !== 'pending').length) : 0;
  return (
    <header className="relative z-20 flex items-center gap-6 px-5 pt-3">
      <NavLink to="/" className="w-[230px] shrink-0 transition hover:brightness-125"><Logo /></NavLink>
      <nav className="flex flex-1 items-center gap-1">
        {TOP.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.to === '/'} className={({ isActive }) => `flex items-center gap-2 rounded-xl px-3.5 py-2 text-[13px] font-medium transition ${isActive ? 'border border-sky-400/50 bg-gradient-to-b from-sky-500/30 to-indigo-600/30 text-white shadow-glow' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}>
            <Icon name={t.icon} className="h-4 w-4" />{t.label}
          </NavLink>
        ))}
      </nav>
      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-4">
          <button aria-label={`${pending} flags awaiting review`} title={`${pending} anomaly flags awaiting human review`} onClick={() => nav('/module/disaster')} className="relative rounded-full p-2 hover:bg-white/5">
            <Icon name="Bell" className="h-5 w-5 text-slate-200" />
            {pending > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold">{pending}</span>}
          </button>
          <div className="grid h-10 w-10 place-items-center rounded-full border-2 border-sky-400/60 bg-gradient-to-br from-indigo-500 to-sky-600 text-sm font-bold shadow-glow" title="Hassan Nasr">HN</div>
        </div>
        <form className="relative w-[230px]" onSubmit={(e) => { e.preventDefault(); if (q.trim()) nav(`/analysis?q=${encodeURIComponent(q.trim())}`); }}>
          <Icon name="Search" className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input aria-label="Ask ORBIT" className="input !rounded-lg !py-1.5 pl-9" placeholder="Ask ORBIT…" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
      </div>
    </header>
  );
}

function Sidebar() {
  const item = (to: string, label: string, icon: string, color = 'text-sky-300') => (
    <NavLink key={to} to={to} end className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-[7px] text-[13px] transition ${isActive ? 'border border-sky-400/40 bg-gradient-to-r from-sky-500/30 to-indigo-500/10 text-white shadow-glow' : 'text-slate-200 hover:bg-white/5'}`}>
      <Icon name={icon} className={`h-4 w-4 ${color}`} />{label}
    </NavLink>
  );
  const colors: Record<string, string> = { earth: 'text-sky-300', disaster: 'text-orange-400', agri: 'text-lime-400', ocean: 'text-cyan-300', infrastructure: 'text-blue-300', gnss: 'text-violet-300', autonomy: 'text-fuchsia-300', explorer: 'text-indigo-300', academy: 'text-amber-300', human: 'text-slate-200' };
  return (
    <aside className="glass relative z-10 flex w-[230px] shrink-0 flex-col overflow-hidden p-3">
      <div className="space-y-0.5">
        {item('/', 'Dashboard', 'LayoutDashboard')}
        {MODULES.map((m) => item(`/module/${m.id}`, m.name, m.icon, colors[m.id]))}
      </div>
      <div className="my-3 border-t border-white/10" />
      <div className="space-y-0.5">
        {item('/data', 'Data Hub', 'Database')}
        {item('/agents', 'AI Agents', 'BrainCircuit')}
        {item('/settings', 'Settings', 'Settings')}
      </div>
      <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-72 rounded-full bg-[radial-gradient(circle_at_50%_30%,rgba(56,189,248,.55),rgba(30,64,175,.35)_40%,transparent_70%)] blur-[2px]" />
      <div className="pointer-events-none absolute -bottom-28 -left-10 h-48 w-64 rounded-[50%] border-t-2 border-sky-300/50" />
    </aside>
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
  return (
    <div className="stars flex h-full min-h-screen flex-col">
      <TopNav />
      <div className="relative z-10 flex min-h-0 flex-1 gap-3 p-3 pt-2">
        <Sidebar />
        <main className="glass relative min-w-0 flex-1 overflow-hidden"><div key={loc.pathname} className="page-in scroll-thin h-full overflow-y-auto p-5"><Outlet /></div></main>
      </div>
      <EvidenceDrawer />
    </div>
  );
}
