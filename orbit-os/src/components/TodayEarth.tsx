import { useEffect, useState } from 'react';
import { Glass, StatusBadge } from './ui';

interface EpicImg { image: string; date: string; caption?: string; centroid_coordinates?: { lat?: number; lon?: number } }

/** Live "Today's Earth" card — latest full-disk Earth image from NASA EPIC / DSCOVR. */
export function TodayEarth() {
  const [img, setImg] = useState<EpicImg | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('https://epic.gsfc.nasa.gov/api/natural')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: EpicImg[]) => { if (alive) setImg(d[0]); })
      .catch((e) => { if (alive) setErr(String(e)); });
    return () => { alive = false; };
  }, []);

  if (err) return <Glass className="p-3 text-xs text-slate-500">Today's Earth image unavailable ({err}).</Glass>;
  if (!img) return <Glass className="p-3 text-xs text-slate-500">Loading today's full-disk Earth…</Glass>;

  const [y, m, d] = (img.date.split(' ')[0] ?? '').split('-');
  const url = `https://epic.gsfc.nasa.gov/archive/natural/${y}/${m}/${d}/png/${img.image}.png`;
  const lat = img.centroid_coordinates?.lat;
  const lon = img.centroid_coordinates?.lon;

  return (
    <Glass className="overflow-hidden p-0">
      <div className="flex items-center justify-between px-3 py-2 text-xs">
        <span className="font-semibold text-white">Today's Earth · NASA EPIC / DSCOVR</span>
        <StatusBadge status="live" note={img.date} />
      </div>
      <img src={url} alt="Full-disk Earth from DSCOVR" className="h-48 w-full object-cover" loading="lazy" />
      <div className="px-3 py-2 text-[11px] text-slate-400">
        {lat != null && lon != null ? `Sub-satellite point ${lat.toFixed(1)}°N, ${lon.toFixed(1)}°E` : 'Full-disk view'} · {img.caption ?? 'NASA EPIC camera onboard NOAA DSCOVR'}
      </div>
    </Glass>
  );
}
