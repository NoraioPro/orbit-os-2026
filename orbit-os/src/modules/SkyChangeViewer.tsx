import { useEffect, useMemo, useRef, useState } from 'react';
import { Chip, Glass, Icon, PageHeader, StatusBadge } from '../components/ui';
import { rng } from './rng';

/**
 * Sky Change Viewer — SPHEREx infrared sky (Space Apps challenge #12).
 *
 * SPHEREx maps the whole sky in 102 near-infrared spectral bands (0.75–5.0 µm)
 * over four all-sky passes during its ~25-month mission. This viewer anchors the
 * concept to a REAL NASA astronomy image (NASA Image Library / APOD, fetched at
 * runtime) and layers a clearly-labelled CONCEPTUAL band-shift scan on top, because
 * SPHEREx full-sky data is not yet streaming here.
 */

interface SkyImage {
  url: string;
  title: string;
  desc: string;
  credit: string;
  source: 'images-api' | 'apod';
  link?: string;
  nasaId?: string;
}

const W = 1000;
const H = 500;
const BANDS = 102;

const FALLBACK: SkyImage = {
  url: 'https://images-assets.nasa.gov/image/PIA12467/PIA12467~orig.jpg',
  title: 'All-Sky Infrared Survey',
  desc: 'An infrared view of the whole sky that highlights the flat plane of our Milky Way galaxy across the middle of the image. NASA WISE would later take a similar infrared census of the whole sky with much improved resolution and sensitivity.',
  credit: 'NASA/JPL-Caltech/IRAS/2MASS/COBE',
  source: 'images-api',
  nasaId: 'PIA12467',
};

function pickLink(links: { href: string; rel: string }[]): string | undefined {
  const order = ['medium', 'large', 'thumb', 'small', 'preview', 'orig', 'canonical'];
  for (const want of order) {
    const l = links.find((x) => x.rel === want);
    if (l) return l.href;
  }
  return links[0]?.href;
}

async function loadSkyImages(): Promise<SkyImage[]> {
  const out: SkyImage[] = [];
  try {
    const r = await fetch('https://images-api.nasa.gov/search?q=infrared%20sky&media_type=image');
    const j = await r.json();
    for (const item of j.collection?.items ?? []) {
      const d = item.data?.[0];
      const url = pickLink(item.links ?? []);
      if (!url) continue;
      out.push({
        url,
        title: d?.title ?? 'NASA image',
        desc: d?.description ?? '',
        credit: d?.secondary_creator ?? d?.center ?? 'NASA',
        source: 'images-api',
        nasaId: d?.nasa_id,
        link: item.href,
      });
    }
  } catch {
    /* images-api failed — try APOD, then static fallback */
  }
  try {
    const r = await fetch('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY');
    const j = await r.json();
    if (j?.media_type === 'image' && j?.url) {
      out.push({
        url: j.hdurl ?? j.url,
        title: j.title,
        desc: j.explanation ?? '',
        credit: j.copyright ?? 'NASA',
        source: 'apod',
        link: 'https://apod.nasa.gov/apod/',
      });
    }
  } catch {
    /* APOD failed too */
  }
  return out;
}

/** False-colour hue for a band (illustrative — infrared is invisible to the eye). */
function bandColor(band: number): { r: number; g: number; b: number } {
  const t = (band - 1) / (BANDS - 1); // 0..1
  const hue = 260 - t * 260; // violet → red as wavelength grows
  return hslToRgb(hue, 72, 60);
}

function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  const sn = s / 100;
  const ln = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) => ln - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) };
}

const bandCenterY = (x: number) => H * 0.52 + Math.sin((x / W) * Math.PI * 2) * 30 + Math.sin((x / W) * Math.PI * 5) * 12;

interface Star { x: number; y: number; r: number; a: number; tw: number }

function buildStars(): Star[] {
  const r = rng(1201);
  const arr: Star[] = [];
  for (let i = 0; i < 900; i++) {
    const x = r() * W;
    const inBand = r() < 0.45;
    const y = inBand ? bandCenterY(x) + (r() - 0.5) * 110 : r() * H;
    arr.push({ x, y: y < 0 ? 0 : y > H ? H : y, r: 0.4 + r() * 1.3, a: 0.25 + r() * 0.75, tw: r() });
  }
  return arr;
}

function render(ctx: CanvasRenderingContext2D, stars: Star[], band: number, pass: number, sweep: number, time: number) {
  const tint = bandColor(band);
  const t = (band - 1) / (BANDS - 1); // 0..1, longer wavelength = brighter dust band
  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#05060f');
  bg.addColorStop(0.5, '#0a0d1e');
  bg.addColorStop(1, '#04050c');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Milky Way galactic plane (real feature of an all-sky infrared map) — soft glow
  for (let i = 0; i <= 40; i++) {
    const x = (i / 40) * W;
    const cy = bandCenterY(x);
    const rad = 46 + Math.sin((x / W) * Math.PI * 3) * 14;
    const g = ctx.createRadialGradient(x, cy, 0, x, cy, rad);
    const glow = 0.04 + 0.10 * t;
    g.addColorStop(0, `rgba(${tint.r},${tint.g},${tint.b},${glow.toFixed(3)})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, cy, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  // Dust lanes (darker filaments along the plane)
  for (let i = 0; i < 14; i++) {
    const x = (i / 13) * W;
    const cy = bandCenterY(x) + (i % 2 ? 14 : -18);
    const g = ctx.createRadialGradient(x, cy, 0, x, cy, 26);
    g.addColorStop(0, 'rgba(2,4,10,0.5)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, cy, 26, 0, Math.PI * 2);
    ctx.fill();
  }

  // Stars
  for (const s of stars) {
    const tw = 1 + 0.25 * Math.sin(time * 2 + s.tw * Math.PI * 2);
    ctx.fillStyle = `rgba(235,240,255,${(s.a * tw).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // False-colour band tint (illustrative)
  ctx.fillStyle = `rgba(${tint.r},${tint.g},${tint.b},0.14)`;
  ctx.fillRect(0, 0, W, H);

  // Survey coverage: pass + fractional sweep (illustrative — SPHEREx data not streamed here)
  const reveal = Math.min(W, (W * (pass + sweep)) / 4);
  if (reveal < W) {
    ctx.fillStyle = 'rgba(3,5,14,0.62)';
    ctx.fillRect(reveal, 0, W - reveal, H);
    // "not yet surveyed" hatch
    ctx.strokeStyle = 'rgba(120,140,180,0.10)';
    ctx.lineWidth = 1;
    for (let x = Math.max(0, Math.ceil(reveal / 24) * 24); x < W; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x - 40, H);
      ctx.stroke();
    }
  }
  // Scan line
  const sg = ctx.createLinearGradient(reveal - 40, 0, reveal + 40, 0);
  sg.addColorStop(0, 'rgba(148,163,184,0)');
  sg.addColorStop(0.5, 'rgba(226,232,240,0.9)');
  sg.addColorStop(1, 'rgba(148,163,184,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(reveal - 40, 0, 80, H);
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fillRect(reveal - 1.5, 0, 3, H);
}

const PASSES = [1, 2, 3, 4];

export function SkyChangeViewer() {
  const [images, setImages] = useState<SkyImage[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [band, setBand] = useState(30);
  const [pass, setPass] = useState(0);
  const [playing, setPlaying] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bandRef = useRef(band);
  const passRef = useRef(pass);
  const playingRef = useRef(playing);
  const sweepRef = useRef(0.2);
  const timeRef = useRef(0);
  bandRef.current = band;
  passRef.current = pass;
  playingRef.current = playing;

  const stars = useMemo(buildStars, []);

  const refresh = () => {
    setLoading(true);
    setError(null);
    loadSkyImages()
      .then((list) => {
        if (list.length) {
          setImages(list);
          setIdx(0);
        } else {
          setImages([FALLBACK]);
          setError('Live NASA APIs unreachable — showing a bundled NASA all-sky infrared image.');
        }
      })
      .catch(() => {
        setImages([FALLBACK]);
        setError('Live NASA APIs unreachable — showing a bundled NASA all-sky infrared image.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    loadSkyImages()
      .then((list) => {
        if (!alive) return;
        if (list.length) setImages(list);
        else {
          setImages([FALLBACK]);
          setError('Live NASA APIs unreachable — showing a bundled NASA all-sky infrared image.');
        }
      })
      .catch(() => {
        if (!alive) return;
        setImages([FALLBACK]);
        setError('Live NASA APIs unreachable — showing a bundled NASA all-sky infrared image.');
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    const draw = () => {
      if (playingRef.current && !reduced) {
        timeRef.current += 1 / 60;
        sweepRef.current = (sweepRef.current + 0.004) % 1;
      }
      render(ctx, stars, bandRef.current, passRef.current, sweepRef.current, timeRef.current);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [stars]);

  const current = images[idx];
  const wavelength = 0.75 + ((band - 1) / (BANDS - 1)) * 4.25;

  return (
    <div className="space-y-3">
      <PageHeader
        icon="Orbit"
        title="Sky Change Viewer"
        subtitle="SPHEREx will map the whole sky in 102 near-infrared bands (0.75–5.0 µm) over four all-sky passes. Scrub the timeline to see how the infrared sky changes."
        right={<StatusBadge status="live" note="real NASA imagery · conceptual scan" />}
      />

      <div className="grid grid-cols-[minmax(0,1fr)_380px] gap-3">
        {/* ---- Live anchor: real NASA image ---- */}
        <Glass className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="h-title">Live anchor · real NASA image</div>
            <div className="flex items-center gap-2">
              {current && <StatusBadge status="live" note={`${current.source} · ${current.nasaId ?? 'APOD'}`} />}
              <button className="btn-ghost !px-2 !py-1 text-xs" onClick={refresh}>
                <Icon name="Download" className="h-3.5 w-3.5" />Reload
              </button>
            </div>
          </div>

          {loading && !current && <div className="mt-3 grid h-64 place-items-center text-sm text-slate-400">Fetching NASA imagery…</div>}

          {current && (
            <div className="mt-3">
              <div className="overflow-hidden rounded-xl border border-white/10 bg-black/40">
                <img src={current.url} alt={current.title} className="h-64 w-full object-cover" loading="lazy" />
              </div>
              <div className="mt-2 text-sm font-semibold text-white">{current.title}</div>
              <p className="mt-0.5 text-xs text-slate-300 line-clamp-3">{current.desc}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                <span>Credit: {current.credit}</span>
                {current.link && <a href={current.link} target="_blank" rel="noreferrer" className="text-sky-300 hover:underline">source ↗</a>}
              </div>
            </div>
          )}

          {images.length > 1 && (
            <div className="scroll-thin mt-3 flex gap-2 overflow-x-auto pb-1">
              {images.slice(0, 8).map((im, i) => (
                <button key={im.url} onClick={() => setIdx(i)} className={`shrink-0 overflow-hidden rounded-lg border transition ${i === idx ? 'border-sky-400/60 ring-2 ring-sky-400/30' : 'border-white/10 opacity-70 hover:opacity-100'}`}>
                  <img src={im.url} alt={im.title} className="h-14 w-20 object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}
          {error && <p className="mt-2 text-xs text-amber-300">{error}</p>}
        </Glass>

        {/* ---- Conceptual band-shift scan ---- */}
        <Glass className="p-4">
          <div className="flex items-center justify-between">
            <div className="h-title">All-sky scan</div>
            <StatusBadge status="sample" note="CONCEPTUAL demo — SPHEREx full-sky data is not streaming here" />
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Illustrative band-shift over the galactic plane. The scan sweep, false colour and coverage are <b className="text-amber-200">conceptual</b>; only the image on the left is real.
          </p>

          <div className="relative mt-3 overflow-hidden rounded-xl border border-white/10 bg-black/50">
            <canvas ref={canvasRef} width={W} height={H} className="block h-auto w-full" />
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-2 text-[10px] text-slate-400">
              <span>all-sky · equirectangular (illustrative)</span>
              <span className="rounded bg-black/50 px-1.5 py-0.5 text-white">Band {band}/{BANDS} · ~{wavelength.toFixed(2)} µm</span>
            </div>
          </div>

          <label className="mt-3 block text-xs text-slate-300">
            Infrared band: <b className="text-white">{band}</b> <span className="text-slate-500">· ~{wavelength.toFixed(2)} µm (approximate; bands are not uniformly spaced)</span>
            <input type="range" min={1} max={BANDS} value={band} onChange={(e) => setBand(+e.target.value)} className="mt-1 w-full" />
          </label>

          <div className="mt-2 flex items-center justify-between text-xs">
            <span className="text-slate-300">Survey pass</span>
            <span className="text-slate-500">Pass {pass + 1} of 4 · each pass adds ~25% sky depth (illustrative)</span>
          </div>
          <div className="mt-1 grid grid-cols-4 gap-1">
            {PASSES.map((p) => (
              <button key={p} onClick={() => setPass(p - 1)} className={`rounded-lg border px-2 py-1.5 text-xs transition ${pass === p - 1 ? 'border-violet-400/50 bg-violet-500/20 text-white' : 'border-white/10 text-slate-400 hover:bg-white/5'}`}>
                Pass {p}
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setPlaying((v) => !v)}>
              <Icon name={playing ? 'Pause' : 'ArrowRight'} className="h-3.5 w-3.5" />{playing ? 'Pause scan' : 'Play scan'}
            </button>
            <span className="text-[11px] text-slate-500">SPHEREx builds up depth over 4 passes · ~25-month survey.</span>
          </div>
        </Glass>
      </div>

      {/* ---- Honesty: real vs illustrative ---- */}
      <Glass className="p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-white"><Icon name="ShieldCheck" className="h-4 w-4 text-sky-300" />What is real vs illustrative</div>
        <ul className="mt-2 grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
          <li className="flex gap-2"><StatusBadge status="live" /><span><b className="text-white">Real:</b> the astronomy image (NASA Image Library / APOD) is a genuine NASA photograph, attributed and fetched live at runtime.</span></li>
          <li className="flex gap-2"><StatusBadge status="sample" /><span><b className="text-white">Conceptual:</b> the band-shift tint, scan sweep and coverage fraction are an animated illustration. SPHEREx full-sky data is not yet streamed here.</span></li>
          <li className="flex gap-2"><Chip>102 bands</Chip><span>SPHEREx observes 102 spectral bands from 0.75 to 5.0 µm.</span></li>
          <li className="flex gap-2"><Chip>4 passes</Chip><span>Four independent all-sky passes over the ~25-month nominal mission.</span></li>
        </ul>
        <p className="mt-2 text-[11px] text-slate-500">The same sky genuinely looks different at different infrared wavelengths — dust and cool gas glow at longer bands. That is real physics; the animation only sketches it.</p>
      </Glass>
    </div>
  );
}

export default SkyChangeViewer;
