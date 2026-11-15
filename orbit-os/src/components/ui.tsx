import { Activity, ArrowRight, Bell, CloudSun, Copy, Bot, Box, BrainCircuit, Building2, ChartColumn, ChevronDown, ChevronRight, ChevronsLeft, ChevronsRight, Circle, CircleCheck, Clock, Compass, Cpu, Database, Download, Droplets, Earth, FileText, Flame, Gamepad2, Globe2, HeartPulse, LayoutDashboard, Layers, Leaf, Mars, Menu, Moon, Mountain, Music, Orbit, Pause, Puzzle, Radio, Ratio, Rocket, Satellite, Search, Settings, ShieldCheck, Snowflake, Sparkles, Sprout, Target, TriangleAlert, Variable, Volume2, Waves, X, Zap } from 'lucide-react';
const Icons = { Activity, ArrowRight, Bell, CloudSun, Copy, Bot, Box, BrainCircuit, Building2, ChartColumn, ChevronDown, ChevronRight, ChevronsLeft, ChevronsRight, Circle, CircleCheck, Clock, Compass, Cpu, Database, Download, Droplets, Earth, FileText, Flame, Gamepad2, Globe2, HeartPulse, LayoutDashboard, Leaf, Mars, Menu, Moon, Mountain, Music, Orbit, Pause, Puzzle, Radio, Ratio, Rocket, Satellite, Search, Settings, ShieldCheck, Snowflake, Sparkles, Sprout, Target, TriangleAlert, Variable, Volume2, Waves, X, Zap };
import type { ReactNode } from 'react';
import type { DataStatus } from '../kernel';

export function Icon({ name, className = 'h-4 w-4', style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const C = (Icons as unknown as Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>>)[name] ?? Icons.Circle;
  return <C className={className} style={style} />;
}

const STATUS_STYLE: Record<string, string> = {
  live: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
  snapshot: 'bg-sky-500/15 text-sky-300 border-sky-400/30',
  sample: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
  'not connected': 'bg-slate-500/15 text-slate-400 border-slate-400/20',
};
export function StatusBadge({ status, title, className = '', note }: { status: DataStatus | 'not connected'; title?: string; className?: string; note?: string }) {
  return (
    <span title={title ?? note ?? `Data status: ${status}`} className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-[1px] text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLE[status]} ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === 'live' ? 'bg-emerald-400' : status === 'snapshot' ? 'bg-sky-400' : status === 'sample' ? 'bg-amber-400' : 'bg-slate-500'}`} />
      {note ?? status}
    </span>
  );
}

export function Glass({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return <div onClick={onClick} className={`glass ${onClick ? 'glass-hover cursor-pointer' : ''} ${className}`}>{children}</div>;
}

export function Chip({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-slate-300 ${className}`}>{children}</span>;
}

/**
 * Compact page header: one card, one row on desktop. The old version spent ~90 px
 * of height on a 28 px title and a two-line subtitle; this keeps the same content
 * at roughly half the height and gives the actions room.
 */
export function PageHeader({ title, subtitle, right, icon, meta }: { title: ReactNode; subtitle?: ReactNode; right?: ReactNode; icon?: string; meta?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
      <div className="flex min-w-0 items-center gap-2.5">
        {icon && (
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-sky-300/20 bg-sky-500/10">
            <Icon name={icon} className="h-4 w-4 text-sky-300" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-[17px] font-semibold leading-tight tracking-tight text-white">{title}</h1>
          {subtitle && <p className="mt-0.5 line-clamp-2 max-w-3xl text-[11px] leading-snug text-slate-400">{subtitle}</p>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {meta}
        {right}
      </div>
    </div>
  );
}

/** Small labelled figure used in headers and strips: value first, source under it. */
export function StatCard({ label, value, unit, note, tone = 'text-white', icon }: { label: string; value: ReactNode; unit?: string; note?: ReactNode; tone?: string; icon?: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5">
      <div className="flex items-center gap-1 text-[8px] uppercase tracking-[0.09em] text-slate-500">
        {icon && <Icon name={icon} className="h-2.5 w-2.5" />}
        {label}
      </div>
      <div className={`text-[15px] font-semibold leading-tight ${tone}`}>
        {value}
        {unit && <span className="ml-0.5 text-[9px] font-normal text-slate-400">{unit}</span>}
      </div>
      {note && <div className="mt-0.5 text-[8px] leading-snug text-slate-500">{note}</div>}
    </div>
  );
}

export function ConfidencePill({ level }: { level: 'low' | 'medium' | 'high' }) {
  const c = level === 'high' ? 'text-emerald-300 border-emerald-400/30 bg-emerald-500/10' : level === 'medium' ? 'text-amber-300 border-amber-400/30 bg-amber-500/10' : 'text-rose-300 border-rose-400/30 bg-rose-500/10';
  return <span className={`rounded-md border px-1.5 py-[1px] text-[10px] font-semibold uppercase ${c}`}>{level} confidence</span>;
}
