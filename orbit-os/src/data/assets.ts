// Asset pack (logo, hero, module images, narration). Tolerant of several manifest shapes; absent files = no asset.
import { useEffect, useState } from 'react';
import { MODULES } from './modules';

export interface Assets { logo?: string; hero?: string; intro?: string; modules: Record<string, { image?: string; audio?: string }> }
const EMPTY: Assets = { modules: {} };

const isImg = (s: string) => /\.(png|jpe?g|webp|svg|gif|avif)$/i.test(s);
const isAudio = (s: string) => /\.(mp3|m4a|ogg|wav)$/i.test(s);
const url = (s: string) => (/^(https?:)?\//.test(s) ? s : `/assets/${s.replace(/^\.?\/?(assets\/)?/, '')}`);

/** Walk any JSON shape and collect string file paths with the key path they were found under. */
function collect(o: unknown, trail: string[] = [], out: { path: string; trail: string }[] = []) {
  if (typeof o === 'string') { if (isImg(o) || isAudio(o)) out.push({ path: o, trail: trail.join('.').toLowerCase() }); }
  else if (Array.isArray(o)) o.forEach((v, i) => { const id = v && typeof v === 'object' ? (v as any).id ?? (v as any).module ?? (v as any).key ?? (v as any).name ?? i : i; collect(v, [...trail, String(id)], out); });
  else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) if (!k.startsWith('_')) collect(v, [...trail, k], out);
  return out;
}

const ALIASES: Record<string, string[]> = {
  earth: ['earth', 'earth-intelligence', 'earth_intelligence', 'earthpulse'], disaster: ['disaster'], agri: ['agri', 'agriculture'], ocean: ['ocean'],
  infrastructure: ['infrastructure', 'infra'], gnss: ['gnss'], autonomy: ['autonomy'], explorer: ['explorer', 'space-explorer', 'space_explorer'],
  academy: ['academy', 'mission-academy', 'mission_academy'], human: ['human', 'human-space', 'human_space'], sar: ['sar'], defense: ['defense', 'situation', 'crisis'],
};

export function normalise(j: unknown): Assets {
  const files = collect(j);
  const a: Assets = { modules: {} };
  for (const f of files) {
    const hay = `${f.trail} ${f.path.toLowerCase()}`;
    const mod = MODULES.find((m) => ALIASES[m.id].some((al) => new RegExp(`(^|[^a-z])${al}([^a-z]|$)`).test(hay)));
    if (mod && !/(^|[^a-z])(logo|hero)([^a-z]|$)/.test(hay)) {
      const slot = (a.modules[mod.id] ??= {});
      if (isImg(f.path)) slot.image ??= url(f.path); else slot.audio ??= url(f.path);
    } else if (/logo/.test(hay) && isImg(f.path)) a.logo ??= url(f.path);
    else if (/hero|command/.test(hay) && isImg(f.path)) a.hero ??= url(f.path);
    else if (/intro/.test(hay) && isAudio(f.path)) a.intro ??= url(f.path);
  }
  return a;
}

let p: Promise<Assets> | null = null;
export const loadAssets = () => (p ??= fetch('/assets/manifest.json').then((r) => (r.ok ? r.json() : {})).then(normalise).catch(() => EMPTY));
export function useAssets() {
  const [a, setA] = useState<Assets>(EMPTY);
  useEffect(() => { loadAssets().then(setA); }, []);
  return a;
}
