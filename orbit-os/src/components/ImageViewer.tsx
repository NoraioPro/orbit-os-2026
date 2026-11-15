import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from './ui';

/**
 * Full-screen image viewer for real satellite products.
 *
 * Click any image that goes through ZoomableImage and it opens here with:
 *   - wheel / buttons to zoom, drag to pan, double-click to reset
 *   - before/after swipe when two images are passed (drag the divider)
 *   - the source, the product date and a link to the original file
 * Every image the app shows as "real data" can therefore be inspected at full
 * resolution instead of being stuck in a 150 px thumbnail.
 */

export interface ViewerImage {
  src: string;
  label: string;
  caption?: string;
  source?: string;
  date?: string;
  href?: string;
}

function Overlay({ before, after, single, onClose }: { before: ViewerImage; after?: ViewerImage; single?: ViewerImage; onClose: () => void }) {
  const img = single ?? before;
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [split, setSplit] = useState(50);
  const [sweep, setSweep] = useState(true);
  const [showB, setShowB] = useState(false);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const splitDrag = useRef(false);
  const stage = useRef<HTMLDivElement>(null);
  const pair = Boolean(after);

  const clamp = (v: number) => Math.min(12, Math.max(1, v));

  useEffect(() => {
    if (!after || !sweep) return;
    let dir = 1;
    const id = window.setInterval(() => {
      setSplit((v) => {
        const next = v + dir * 1.1;
        if (next >= 100) dir = -1;
        if (next <= 0) dir = 1;
        return Math.min(100, Math.max(0, next));
      });
    }, 40);
    return () => window.clearInterval(id);
  }, [after, sweep]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '+' || e.key === '=') setZoom((z) => clamp(z * 1.25));
      if (e.key === '-') setZoom((z) => clamp(z / 1.25));
      if (e.key === '0') {
        setZoom(1);
        setPos({ x: 0, y: 0 });
      }
      if (e.key === 'ArrowLeft' && pair) setSplit((s) => Math.max(0, s - 4));
      if (e.key === 'ArrowRight' && pair) setSplit((s) => Math.min(100, s + 4));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, pair]);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((z) => clamp(z * (e.deltaY < 0 ? 1.12 : 0.89)));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (splitDrag.current && stage.current) {
      setSweep(false);
      const r = stage.current.getBoundingClientRect();
      setSplit(Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)));
      return;
    }
    if (!drag.current) return;
    setPos({ x: drag.current.px + (e.clientX - drag.current.x), y: drag.current.py + (e.clientY - drag.current.y) });
  };
  const onPointerUp = () => {
    drag.current = null;
    splitDrag.current = false;
  };

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-slate-950/95 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <div className="min-w-0">
          <div className="truncate text-[12px] font-semibold text-white">{img.label}</div>
          <div className="truncate text-[10px] text-slate-400">
            {img.source}
            {img.date ? ` · ${img.date}` : ''}
            {img.caption ? ` · ${img.caption}` : ''}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {pair && (
            <button
              type="button"
              onClick={() => setSweep((v) => !v)}
              className={`rounded border px-2 py-1 text-[10px] ${sweep ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-200' : 'border-white/15 text-slate-300'}`}
              title="Animate the divider across the pair"
            >
              {sweep ? 'sweep on' : 'sweep off'}
            </button>
          )}
          {pair && (
            <button
              type="button"
              onClick={() => setShowB((v) => !v)}
              className={`rounded border px-2 py-1 text-[10px] ${showB ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-200' : 'border-white/15 text-slate-300'}`}
              title="Toggle side-by-side"
            >
              side by side
            </button>
          )}
          <button type="button" onClick={() => setZoom((z) => clamp(z / 1.25))} className="rounded border border-white/15 px-2 py-1 text-[10px] text-slate-300">−</button>
          <span className="w-10 text-center font-mono text-[10px] text-slate-400">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((z) => clamp(z * 1.25))} className="rounded border border-white/15 px-2 py-1 text-[10px] text-slate-300">+</button>
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setPos({ x: 0, y: 0 });
            }}
            className="rounded border border-white/15 px-2 py-1 text-[10px] text-slate-300"
          >
            reset
          </button>
          {img.href && (
            <a href={img.href} target="_blank" rel="noreferrer" className="rounded border border-white/15 px-2 py-1 text-[10px] text-sky-300">
              original ↗
            </a>
          )}
          <button type="button" onClick={onClose} className="rounded border border-white/15 px-2 py-1 text-[10px] text-slate-300" title="Close (Esc)">
            <Icon name="X" className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div
        ref={stage}
        className="relative flex-1 overflow-hidden"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onDoubleClick={() => {
          setZoom(1);
          setPos({ x: 0, y: 0 });
        }}
        style={{ cursor: zoom > 1 ? 'grab' : 'zoom-in' }}
      >
        {pair && showB ? (
          <div className="grid h-full grid-cols-2 gap-1 p-1">
            {[before, after!].map((i, k) => (
              <div key={k} className="relative overflow-hidden rounded border border-white/10">
                <img src={i.src} alt={i.label} className="h-full w-full object-contain" />
                <div className="absolute left-1 top-1 rounded bg-slate-950/80 px-1 text-[9px] text-slate-200">
                  {i.date ?? (k === 0 ? 'before' : 'after')}
                </div>
              </div>
            ))}
          </div>
        ) : pair ? (
          <div className="absolute inset-0">
            <img src={before.src} alt={before.label} className="absolute inset-0 m-auto max-h-full max-w-full object-contain" style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${zoom})` }} />
            <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 0 0 ${split}%)` }}>
              <img src={after!.src} alt={after!.label} className="absolute inset-0 m-auto max-h-full max-w-full object-contain" style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${zoom})` }} />
            </div>
            <div
              className="absolute inset-y-0 w-[2px] cursor-ew-resize bg-white/80"
              style={{ left: `${split}%` }}
              onPointerDown={(e) => {
                e.stopPropagation();
                splitDrag.current = true;
              }}
            >
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/60 bg-slate-900/90 px-1.5 py-0.5 text-[9px] text-white">
                drag
              </span>
            </div>
            <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-slate-950/80 px-1.5 py-0.5 text-[10px] text-amber-200">
              before {before.date ?? ''}
            </div>
            <div className="pointer-events-none absolute bottom-2 right-2 rounded bg-slate-950/80 px-1.5 py-0.5 text-[10px] text-cyan-200">
              after {after!.date ?? ''}
            </div>
          </div>
        ) : (
          <img
            src={img.src}
            alt={img.label}
            className="absolute inset-0 m-auto max-h-full max-w-full object-contain"
            style={{ transform: `translate(${pos.x}px, ${pos.y}px) scale(${zoom})` }}
            draggable={false}
          />
        )}
      </div>

      <div className="border-t border-white/10 px-3 py-1 text-[9px] text-slate-500">
        wheel to zoom · drag to pan · double-click to reset{pair ? " · the divider sweeps automatically (toggle sweep) · drag it to take over · ←/→ to nudge" : ''} · Esc to close
      </div>
    </div>
  );
}

export function ZoomableImage({
  src,
  alt,
  className,
  before,
  after,
  label,
  caption,
  source,
  date,
  href,
  loading = 'lazy',
}: {
  src: string;
  alt: string;
  className?: string;
  before?: ViewerImage;
  after?: ViewerImage;
  label?: string;
  caption?: string;
  source?: string;
  date?: string;
  href?: string;
  loading?: 'lazy' | 'eager';
}) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  const perma = useCallback(
    (img: ViewerImage) => ({
      ...img,
      href: img.href ?? img.src,
    }),
    [],
  );

  if (failed) {
    return (
      <div className={`grid place-items-center rounded border border-white/5 bg-slate-900/60 text-[10px] text-slate-500 ${className ?? 'h-[150px] w-full'}`}>
        image unavailable
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group relative block overflow-hidden ${className ?? ''}`}
        title={`Open ${label ?? alt} full screen`}
      >
        <img src={src} alt={alt} className="h-full w-full object-cover" loading={loading} onError={() => setFailed(true)} />
        <span className="pointer-events-none absolute right-1 top-1 rounded bg-slate-950/75 px-1 py-0.5 text-[8px] text-slate-200 opacity-0 transition group-hover:opacity-100">
          open
        </span>
      </button>
      {open && (
        <Overlay
          single={before || after ? undefined : perma({ src, label: label ?? alt, caption, source, date, href })}
          before={perma(before ?? { src, label: label ?? alt })}
          after={after ? perma(after) : undefined}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

export default ZoomableImage;
