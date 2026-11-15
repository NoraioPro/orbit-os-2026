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
export function WeatherNow({ lat, lon, label, compact = false }: { lat: number; lon: number; label: string; compact?: boolean }) {
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

  if (err) return <p className="text-[10px] text-slate-500">Live weather unavailable ({err}).</p>;
  if (!d) return <p className="text-[10px] text-slate-500">Loading live weather…</p>;

  const ts = d.properties.timeseries;
  const cur = ts[0].data.instant.details;
  const next = ts.slice(1, 13);

  if (compact) {
    return (
      <div>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[15px] font-semibold text-white">{cur.air_temperature.toFixed(1)}°C</span>
          <span className="text-[9px] text-slate-400">
            {label} · wind {cur.wind_speed.toFixed(1)} m/s · {cur.relative_humidity.toFixed(0)}% RH
          </span>
        </div>
        <div className="mt-1 flex items-end gap-[3px]">
          {next.slice(0, 10).map((t, i) => {
            const v = t.data.instant.details.air_temperature;
            const h = Math.max(4, Math.min(22, ((v + 20) / 40) * 22));
            return (
              <span key={i} className="flex flex-col items-center gap-[1px]" title={`${t.time.slice(11, 16)} · ${v.toFixed(1)}°C`}>
                <span className="w-[10px] rounded-sm bg-sky-400/70" style={{ height: `${h}px` }} />
                <span className="text-[7px] text-slate-500">{t.time.slice(11, 13)}</span>
              </span>
            );
          })}
        </div>
        <div className="mt-1 text-[8px] text-slate-500">
          MET Norway Locationforecast 2.0 · updated {d.properties.meta.updated_at.slice(0, 16).replace('T', ' ')} UTC
        </div>
      </div>
    );
  }

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
