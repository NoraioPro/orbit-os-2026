import { useEffect, useRef, useState } from 'react';
import type { SeriesPoint } from '../kernel';

export function LineChart({ points, trend, unit, height = 180, bars = false, color = '#38bdf8', xLabel }: { points: SeriesPoint[]; trend?: { slope: number; intercept: number }; unit: string; height?: number; bars?: boolean; color?: string; xLabel?: (x: number) => string }) {
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(560);
  useEffect(() => { const el = box.current; if (!el) return; const ro = new ResizeObserver(() => setW(Math.max(240, el.clientWidth))); ro.observe(el); return () => ro.disconnect(); }, []);
  const H = height, pl = 44, pr = 12, pt = 12, pb = 26;
  const vals = points.filter((p) => p.y !== null) as { x: number; y: number }[];
  if (!vals.length) return <div ref={box} className="grid h-24 place-items-center text-xs text-slate-500">No data</div>;
  const xs = points.map((p) => p.x);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  let y0 = Math.min(...vals.map((p) => p.y)), y1 = Math.max(...vals.map((p) => p.y));
  if (bars) y0 = Math.min(0, y0);
  if (y0 === y1) { y0 -= 1; y1 += 1; }
  const pad = (y1 - y0) * 0.08; y0 -= bars ? 0 : pad; y1 += pad;
  const sx = (x: number) => pl + ((x - x0) / (x1 - x0 || 1)) * (W - pl - pr);
  const sy = (y: number) => pt + (1 - (y - y0) / (y1 - y0)) * (H - pt - pb);
  const path = vals.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
  const ticks = 4;
  const bw = Math.max(2, (W - pl - pr) / points.length - 2);
  const xl = xLabel ?? ((x: number) => String(x));
  return (
    <div ref={box} className="w-full"><svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block" role="img" aria-label={`Chart in ${unit}`}>
      <defs><linearGradient id="lcfill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".35" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      {Array.from({ length: ticks + 1 }, (_, i) => { const y = y0 + ((y1 - y0) * i) / ticks; return (<g key={i}><line x1={pl} x2={W - pr} y1={sy(y)} y2={sy(y)} stroke="#334155" strokeOpacity=".5" strokeDasharray="2 4" /><text x={pl - 6} y={sy(y) + 3} textAnchor="end" fontSize="10" fill="#94a3b8">{Math.abs(y) >= 100 ? y.toFixed(0) : y.toFixed(Math.abs(y1 - y0) < 2 ? 2 : 1)}</text></g>); })}
      {bars ? points.map((p, i) => p.y !== null && <rect key={i} x={sx(p.x) - bw / 2} y={sy(Math.max(0, p.y))} width={bw} height={Math.abs(sy(p.y) - sy(0))} rx="2" fill={color} fillOpacity=".75" />)
        : (<><path d={`${path} L${sx(vals[vals.length - 1].x)},${H - pb} L${sx(vals[0].x)},${H - pb} Z`} fill="url(#lcfill)" /><path d={path} fill="none" stroke={color} strokeWidth="2" />{vals.length <= 80 && vals.map((p, i) => <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="2.6" fill={color}><title>{`${xl(p.x)}: ${p.y.toFixed(2)} ${unit}`}</title></circle>)}</>)}
      {trend && <line x1={sx(x0)} x2={sx(x1)} y1={sy(trend.intercept + trend.slope * x0)} y2={sy(trend.intercept + trend.slope * x1)} stroke="#f472b6" strokeWidth="1.6" strokeDasharray="5 4" />}
      {[x0, Math.round((x0 + x1) / 2), x1].map((x, i) => <text key={i} x={sx(x)} y={H - 8} textAnchor="middle" fontSize="10" fill="#94a3b8">{xl(x)}</text>)}
      <text x={W - pr} y={pt + 2} textAnchor="end" fontSize="10" fill="#64748b">{unit}</text>
    </svg></div>
  );
}
