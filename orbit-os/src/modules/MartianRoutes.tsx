import { useEffect, useMemo, useState } from 'react';
import { Chip, Glass, Icon, PageHeader, StatusBadge } from '../components/ui';
import { routePlan } from '../kernel';
import { rng } from './rng';

type World = 'mars' | 'svalbard';

const N = 22;
const DEFAULT_START: [number, number] = [2, 2];
const DEFAULT_GOAL: [number, number] = [N - 3, N - 3];

/** Visual + terrain-cost profile per world. Same A* kernel, different cost field. */
const WORLD_META: Record<World, { name: string; blurb: string; icon: string; cell: (c: number) => string }> = {
  mars: {
    name: 'Mars rover surface',
    blurb: 'Warm, dusty regolith with a buried ridge — traversal costs are higher and rocks are more punishing.',
    icon: 'Mars',
    cell: (c) => `rgba(234,88,12,${(0.15 + c / 9).toFixed(3)})`,
  },
  svalbard: {
    name: 'Svalbard drone (Earth analog)',
    blurb: 'Cold Arctic analog terrain — gentler slopes, but the same planning problem for a field drone.',
    icon: 'Snowflake',
    cell: (c) => `rgba(56,189,248,${(0.12 + c / 7).toFixed(3)})`,
  },
};

/** Deterministic, seeded SAMPLE terrain-cost grid. Infinity = impassable ridge. */
function genCost(world: World): number[][] {
  const r = rng(world === 'mars' ? 10 : 77);
  return Array.from({ length: N }, (_, y) =>
    Array.from({ length: N }, (_, x) => {
      const ridge = Math.abs(x - 11 - Math.sin(y / 3) * 3) < 1.2 && y > 3 && y < 19 ? Infinity : 1 + r() * (world === 'mars' ? 4 : 2.5);
      return ridge;
    }),
  );
}

interface NasaImage { url: string; title: string; id: string; date: string }

export function MartianRoutes() {
  const [world, setWorld] = useState<World>('mars');
  const [start, setStart] = useState<[number, number]>(DEFAULT_START);
  const [goal, setGoal] = useState<[number, number]>(DEFAULT_GOAL);
  const [placing, setPlacing] = useState<'start' | 'goal'>('start');
  const [revealed, setRevealed] = useState(0);
  const [replay, setReplay] = useState(0);
  const [img, setImg] = useState<NasaImage | null>(null);
  const [imgStatus, setImgStatus] = useState<'loading' | 'live' | 'error'>('loading');

  // Live NASA image for the header (Image & Video Library).
  useEffect(() => {
    let alive = true;
    fetch('https://images-api.nasa.gov/search?q=mars%20surface&media_type=image')
      .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
      .then((json: any) => {
        const items: any[] = json?.collection?.items ?? [];
        if (!items.length) throw new Error('no results');
        const it = items[0];
        const links: any[] = it?.links ?? [];
        const url: string | undefined =
          links.find((l) => l.rel === 'preview')?.href ?? links.find((l) => l.rel === 'alternate')?.href ?? links[0]?.href;
        const data = it?.data?.[0] ?? {};
        if (!url) throw new Error('no image link');
        if (alive) {
          setImg({ url, title: data.title ?? 'Mars surface', id: data.nasa_id ?? '—', date: data.date_created ?? '' });
          setImgStatus('live');
        }
      })
      .catch(() => { if (alive) setImgStatus('error'); });
    return () => { alive = false; };
  }, []);

  const marsCost = useMemo(() => genCost('mars'), []);
  const svalCost = useMemo(() => genCost('svalbard'), []);
  const cost = world === 'mars' ? marsCost : svalCost;

  // The same kernel, run on both worlds. This is the transfer pattern.
  const marsPlan = useMemo(() => routePlan(marsCost, start, goal), [marsCost, start, goal]);
  const svalPlan = useMemo(() => routePlan(svalCost, start, goal), [svalCost, start, goal]);
  const plan = world === 'mars' ? marsPlan : svalPlan;
  const { path, energy } = plan;

  // Animate the A* path: reveal cells in order, rover head leads.
  useEffect(() => {
    setRevealed(0);
    if (!path.length) return;
    const id = window.setInterval(() => {
      setRevealed((prev) => {
        if (prev >= path.length) { window.clearInterval(id); return prev; }
        return prev + 1;
      });
    }, 40);
    return () => window.clearInterval(id);
  }, [path, replay]);

  const onCell = (r: number, c: number, costVal: number) => {
    if (!Number.isFinite(costVal)) return;
    if (placing === 'start') { setStart([r, c]); setPlacing('goal'); }
    else { setGoal([r, c]); setPlacing('start'); }
  };

  const pathSet = new Set(path.slice(0, revealed).map(([r, c]) => r * N + c));
  const rover = revealed > 0 ? path[Math.min(revealed, path.length) - 1] : null;
  const meta = WORLD_META[world];

  return (
    <div className="space-y-3">
      <PageHeader
        icon="Mars"
        title="Martian Route Map"
        subtitle="Energy-limited A* route planning — one kernel, Earth and Mars."
        right={<StatusBadge status="sample" note="terrain grid is synthetic; NASA image is live" />}
      />

      {/* Live NASA image header */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10">
        {img && <img src={img.url} alt={img.title} className="absolute inset-0 h-full w-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/75 to-slate-950/25" />
        <div className="relative p-4">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status="live" note="NASA Image & Video Library — live" />
            <Chip>images-api.nasa.gov</Chip>
          </div>
          <div className="mt-1.5 text-sm font-bold text-white">{img?.title ?? 'Mars surface'}</div>
          <div className="text-[11px] text-slate-300">
            {imgStatus === 'live' && img
              ? `NASA Image ${img.id} · ${img.date.slice(0, 10)} · NASA Image & Video Library`
              : imgStatus === 'error'
                ? 'Live Mars image unavailable right now — header shown without imagery.'
                : 'Fetching live Mars image from the NASA Image & Video Library…'}
          </div>
        </div>
      </div>

      {/* World toggle + controls */}
      <Glass className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="h-title">Terrain-cost grid — {meta.name}</div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 text-xs">
              {(Object.keys(WORLD_META) as World[]).map((w) => (
                <button key={w} onClick={() => setWorld(w)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 ${world === w ? 'border-fuchsia-400/50 bg-fuchsia-500/20 text-white' : 'border-white/10 text-slate-400 hover:bg-white/5'}`}>
                  <Icon name={WORLD_META[w].icon} className="h-3.5 w-3.5" />{w === 'mars' ? 'Mars rover' : 'Svalbard drone'}
                </button>
              ))}
            </div>
            <button className="btn-ghost !py-1 text-xs" onClick={() => setReplay((k) => k + 1)}><Icon name="Zap" />Replay route</button>
          </div>
        </div>

        <div className="mt-1 flex items-start gap-2 rounded-lg border border-amber-400/25 bg-amber-500/5 p-2 text-[11px] text-amber-200">
          <StatusBadge status="sample" />
          <span>Terrain grid is <b>SAMPLE</b> (synthetic, seeded &amp; reproducible). Real HiRISE / MOLA elevation data is not connected. Click cells to move <span className="text-green-300">start</span> / <span className="text-red-300">goal</span> — placing <b>{placing}</b> now.</span>
        </div>

        <div className="mx-auto mt-3 grid w-full max-w-[420px] gap-[1px]" style={{ gridTemplateColumns: `repeat(${N}, 1fr)` }}>
          {cost.flatMap((row, r) =>
            row.map((c, col) => {
              const i = r * N + col;
              const isStart = start[0] === r && start[1] === col;
              const isGoal = goal[0] === r && goal[1] === col;
              const isRover = rover !== null && rover[0] === r && rover[1] === col;
              const blocked = !Number.isFinite(c);
              const bg = blocked ? '#0b1220' : pathSet.has(i) ? '#e879f9' : meta.cell(c);
              return (
                <button key={i} onClick={() => onCell(r, col, c)}
                  className="relative aspect-square rounded-[1px] transition-colors"
                  style={{ background: bg }}
                  title={blocked ? 'blocked ridge' : `cost ${c.toFixed(1)}`}
                  aria-label={blocked ? 'blocked' : `cost ${c.toFixed(1)}`}>
                  {isStart && <span className="absolute inset-0 m-auto h-2 w-2 rounded-full bg-green-400" />}
                  {isGoal && <span className="absolute inset-0 m-auto h-2 w-2 rounded-full bg-red-400" />}
                  {isRover && !isStart && !isGoal && <span className="absolute inset-0 m-auto h-2.5 w-2.5 rounded-full bg-white" />}
                </button>
              );
            }),
          )}
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-slate-400">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-[1px]" style={{ background: meta.cell(3) }} />low cost</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-[1px]" style={{ background: meta.cell(5) }} />high cost</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-[1px] bg-[#0b1220]" />blocked</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-[1px] bg-[#e879f9]" />A* path</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-400" />start</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400" />goal</span>
        </div>

        <p className="mt-2 text-xs text-slate-300">
          {Number.isFinite(energy)
            ? <>Path <b className="text-white">{path.length}</b> cells · energy cost <b className="text-white">{energy.toFixed(1)}</b> units (sample).</>
            : <span className="text-amber-300">No route — start/goal separated by the ridge. Move one to a clear cell.</span>}
        </p>
      </Glass>

      {/* Transfer pattern explanation */}
      <Glass className="p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white"><Icon name="Rocket" className="h-4 w-4 text-fuchsia-300" />The transfer pattern — one A* kernel, two worlds</div>
        <p className="mt-1 text-xs leading-relaxed text-slate-300">
          Both worlds run the <b className="text-white">exact same</b> <code className="text-fuchsia-200">routePlan(cost, start, goal)</code> kernel from the planning engine.
          Only the terrain-cost field changes — Mars gets a harsher, rockier cost surface; Svalbard a gentler Earth-analog one. That is ORBIT's "Earth analog → Mars" transfer: validate a planner on the analog, then run the identical kernel off-world with no rewrite.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-orange-400/25 bg-orange-500/5 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-orange-200"><Icon name="Mars" className="h-4 w-4" />Mars rover</div>
            <div className="mt-1 text-2xl font-bold text-white">{Number.isFinite(marsPlan.energy) ? marsPlan.energy.toFixed(1) : '∞'}<span className="text-xs font-normal text-slate-400"> energy</span></div>
            <div className="text-[11px] text-slate-400">{marsPlan.path.length} cells · harsher cost field</div>
          </div>
          <div className="rounded-lg border border-sky-400/25 bg-sky-500/5 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-sky-200"><Icon name="Snowflake" className="h-4 w-4" />Svalbard drone</div>
            <div className="mt-1 text-2xl font-bold text-white">{Number.isFinite(svalPlan.energy) ? svalPlan.energy.toFixed(1) : '∞'}<span className="text-xs font-normal text-slate-400"> energy</span></div>
            <div className="text-[11px] text-slate-400">{svalPlan.path.length} cells · same kernel, gentler field</div>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">Both figures are computed live in this browser from the same SAMPLE grid generator — energy values are synthetic and meant to illustrate the method, not mission data.</p>
      </Glass>
    </div>
  );
}

export default MartianRoutes;
