import { useEffect, useState } from 'react';
import { Glass, StatusBadge } from './ui';

const SYMBOL_EMOJI: Record<string, string> = {
  clearsky_day: '☀️', clearsky_night: '🌙', fair_day: '🌤️', fair_night: '🌙',
  partlycloudy_day: '⛅', partlycloudy_night: '☁️', cloudy: '☁️',
  lightrain: '🌦️', rain: '🌧️', heavyrain: '🌧️',
  rainshowers_day: '🌦️', rainshowers_night: '🌧️',
  lightsnow: '🌨️', snow: '❄️', heavysnow: '❄️',
  lightsleet: '🌨️', sleet: '🌨️', fog: '🌫️',
};
const emoji = (code: string) => SYMBOL_EMOJI[code] ?? '·';

interface YrPoint {
  time: string;
  data: {
    instant: { details: { air_temperature: number; wind_speed: number; relative_humidity: number } };
    next_1_hours?: { summary?: { symbol_code?: string } };
    next_6_hours?: { summary?: { symbol_code?: string } };
  };
}
interface YrRes { properties: { meta: { updated_at: string }; timeseries: YrPoint[] } }

const symbolOf = (t: YrPoint) => t.data.next_1_hours?.summary?.symbol_code ?? t.data.next_6_hours?.summary?.symbol_code ?? '';

/** Live weather from MET Norway Yr (locationforecast/2.0, keyless, CORS-open). */
export function WeatherNow({ lat, lon, label }: { lat: number; lon: number; label: string }) {
  const [d, setD] = useState<YrRes | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lon}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((x: YrRes) => { if (alive) setD(x); })
      .catch((e) => { if (alive) setErr(String(e)); });
    return () => { alive = false; };
  }, [lat, lon]);

  if (err) return <Glass className="p-3 text-xs text-slate-500">Live weather unavailable ({err}).</Glass>;
  if (!d) return <Glass className="p-3 text-xs text-slate-500">Loading live weather…</Glass>;

  const ts = d.properties.timeseries;
  const cur = ts[0].data.instant.details;
  const next = ts.slice(1, 13);

  return (
    <Glass className="p-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-white">Live weather · {label}</span>
        <StatusBadge status="live" note={d.properties.meta.updated_at.slice(0, 16).replace('T', ' ')} />
      </div>
      <div className="mt-1 flex items-baseline gap-3">
        <span className="text-2xl font-bold text-white">{cur.air_temperature.toFixed(1)}°C</span>
        <span className="text-xs text-slate-400">wind {cur.wind_speed.toFixed(1)} m/s · {cur.relative_humidity.toFixed(0)}% RH</span>
      </div>
      <div className="scroll-thin mt-1.5 flex gap-1 overflow-x-auto pb-0.5">
        {next.map((t, i) => (
          <div key={i} className="min-w-[44px] rounded-md border border-white/10 bg-white/[.03] px-1 py-1 text-center">
            <div className="text-[9px] text-slate-500">{t.time.slice(11, 16)}</div>
            <div className="text-[11px] text-slate-200">{t.data.instant.details.air_temperature.toFixed(0)}°</div>
            <div className="text-[11px] leading-none">{emoji(symbolOf(t))}</div>
          </div>
        ))}
      </div>
    </Glass>
  );
}

/** Which site each weather-relevant module shows live conditions for. */
export const WEATHER_SITES: Record<string, { lat: number; lon: number; label: string }> = {
  earth: { lat: 78.22, lon: 15.65, label: 'Svalbard' },
  disaster: { lat: 59.91, lon: 10.75, label: 'Oslo' },
  agri: { lat: 13.5, lon: 2.1, label: 'Sahel · Niamey' },
  ocean: { lat: 60.0, lon: -30.0, label: 'North Atlantic' },
};
