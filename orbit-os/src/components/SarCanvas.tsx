import { useEffect, useRef } from 'react';
import type { SarRaster } from '../kernel';

/* Smooth canvas renderer for SAR rasters — replaces the blocky <div> grids.
 * Renders the low-res raster to a small offscreen canvas, then scales up with
 * interpolation for a smooth, speckled radar look. */

export type Rgb = [number, number, number];

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

/** Grayscale amplitude — like a real SAR σ0 image (dark = low backscatter). */
export const ampPalette = (v: number): Rgb => {
  const g = Math.round(20 + clamp01((v + 24) / 12) * 220);
  return [g, g, g];
};

/** Diverging change map — blue = backscatter drop, orange/purple = rise, dark = none. */
export const changePalette = (v: number): Rgb => {
  if (v >= 6) return [168, 85, 247];
  if (v >= 3) return [249, 115, 22];
  if (v <= -6) return [29, 78, 216];
  if (v <= -3) return [56, 189, 248];
  return [13, 18, 32];
};

function hslToRgb(h: number, s: number, l: number): Rgb {
  const sn = s / 100, ln = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number) => ln - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

/** Cyclic rainbow for wrapped interferometric phase (the classic fringe look). */
export const phasePalette = (v: number): Rgb => {
  const t = ((v % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return hslToRgb((t / (2 * Math.PI)) * 300, 82, 52);
};

export function SarCanvas({ r, palette, className = 'w-full rounded-lg', intensity = 1 }: { r: SarRaster; palette: (v: number) => Rgb; className?: string; intensity?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const c = ref.current; if (!c) return;
    const off = document.createElement('canvas');
    off.width = r.width; off.height = r.height;
    const octx = off.getContext('2d')!;
    const img = octx.createImageData(r.width, r.height);
    const d = img.data;
    for (let i = 0; i < r.values.length; i++) {
      const [rr, gg, bb] = palette(r.values[i]);
      d[i * 4] = rr; d[i * 4 + 1] = gg; d[i * 4 + 2] = bb; d[i * 4 + 3] = 255;
    }
    octx.putImageData(img, 0, 0);

    const S = 288;
    c.width = S; c.height = S;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(off, 0, 0, S, S);
  }, [r, palette, intensity]);

  return <canvas ref={ref} className={className} style={{ aspectRatio: '1 / 1', objectFit: 'cover' }} />;
}

export default SarCanvas;
