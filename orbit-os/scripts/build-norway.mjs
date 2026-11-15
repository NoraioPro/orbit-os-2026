#!/usr/bin/env node
/**
 * Norwegian official data layer — MET Norway + NVE, keyless, real.
 *
 * Everything here comes from a Norwegian public API and carries the timestamp it
 * was fetched plus the licence it is published under (MET Norway: CC BY 4.0,
 * NVE: NLOD). A failed or empty response is stored as an explicit empty value so
 * the UI can say "no warnings issued" instead of inventing one.
 *
 *   npm run data:norway
 */
import { mkdirSync, writeFileSync } from 'node:fs';

const UA = 'ORBIT OS space-apps/1.0 (research; noraiopro@gmail.com)';
const OUT = 'public/data/norway';

const AOIS = [
  {
    id: 'oslo',
    name: 'Oslo',
    lat: 59.9139,
    lon: 10.7522,
    use: 'Bridge and roadway integrity — wind and precipitation load the structures the InSAR board tracks.',
    floodRegion: 1,
    landslideRegion: 1,
    air: true,
    metar: 'ENGM',
  },
  {
    id: 'ostfold',
    name: 'Østfold',
    lat: 59.39,
    lon: 11.0,
    use: 'Field operations — frost and soil temperature decide whether heavy machinery can move.',
    floodRegion: 2,
    landslideRegion: 2,
    air: true,
  },
  {
    id: 'longyearbyen',
    name: 'Longyearbyen · Svalbard',
    lat: 78.2232,
    lon: 15.6469,
    use: 'Polar operations — be aware of polar night, wind chill and the ice edge before any vessel or field work.',
    floodRegion: 0,
    landslideRegion: 0,
    air: false,
  },
  {
    id: 'barents',
    name: 'Barents Sea · 76.5N 20E',
    lat: 76.5,
    lon: 20.0,
    use: 'Vessel routing through the ice margin — sea state and water temperature next to the ice edge.',
    floodRegion: 0,
    landslideRegion: 0,
    air: false,
    ocean: true,
  },
];

const ymd = (d = new Date()) => d.toISOString().slice(0, 10);

async function json(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function safe(fn, fallback = null) {
  try {
    return await fn();
  } catch (e) {
    return { __error: String(e).slice(0, 120), __fallback: fallback };
  }
}

function series(timeseries, steps = 24) {
  return {
    hours: timeseries.slice(0, steps).map((t) => ({
      at: t.time,
      airTempC: t.data.instant.details.air_temperature ?? null,
      windMs: t.data.instant.details.wind_speed ?? null,
      windDirDeg: t.data.instant.details.wind_from_direction ?? null,
      humidityPct: t.data.instant.details.relative_humidity ?? null,
      cloudPct: t.data.instant.details.cloud_area_fraction ?? null,
      precipMm: t.data.next_1_hours?.details?.precipitation_amount ?? null,
      symbol: t.data.next_1_hours?.summary?.symbol_code ?? null,
    })),
  };
}

async function buildAoi(aoi) {
  const fetchedAt = new Date().toISOString();
  const block = {
    id: aoi.id,
    name: aoi.name,
    lat: aoi.lat,
    lon: aoi.lon,
    use_case: aoi.use,
    fetched_at: fetchedAt,
  };

  const forecast = await safe(() =>
    json(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${aoi.lat}&lon=${aoi.lon}`),
  );
  if (forecast && forecast.properties && forecast.properties.timeseries) {
    const ts = forecast.properties.timeseries;
    block.forecast = {
      updated: forecast.properties.meta?.updated_at ?? null,
      source: 'MET Norway · Locationforecast 2.0',
      url: `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${aoi.lat}&lon=${aoi.lon}`,
      now: {
        airTempC: ts[0].data.instant.details.air_temperature ?? null,
        windMs: ts[0].data.instant.details.wind_speed ?? null,
        windDirDeg: ts[0].data.instant.details.wind_from_direction ?? null,
        humidityPct: ts[0].data.instant.details.relative_humidity ?? null,
        pressureHpa: ts[0].data.instant.details.air_pressure_at_sea_level ?? null,
        cloudPct: ts[0].data.instant.details.cloud_area_fraction ?? null,
        symbol: ts[0].data.next_1_hours?.summary?.symbol_code ?? null,
        precipNextHourMm: ts[0].data.next_1_hours?.details?.precipitation_amount ?? null,
      },
      hours: series(ts).hours,
      hours_available: ts.length,
      licence: 'CC BY 4.0 · MET Norway',
    };
  } else {
    block.forecast = { unavailable: forecast?.__error ?? 'no data', source: 'MET Norway · Locationforecast 2.0' };
  }

  // sea state, only requested for marine AOIs
  if (aoi.ocean) {
    const ocean = await safe(() =>
      json(`https://api.met.no/weatherapi/oceanforecast/2.0/complete?lat=${aoi.lat}&lon=${aoi.lon}`),
    );
    const ts = ocean?.properties?.timeseries;
    if (Array.isArray(ts)) {
      block.ocean = {
        updated: ocean.properties.meta?.updated_at ?? null,
        source: 'MET Norway · Oceanforecast 2.0',
        url: `https://api.met.no/weatherapi/oceanforecast/2.0/complete?lat=${aoi.lat}&lon=${aoi.lon}`,
        seaWaterTempC: ts[0].data.instant.details.sea_water_temperature ?? null,
        waveHeightM: ts[0].data.instant.details.sea_surface_wave_height ?? null,
        waveDirectionDeg: ts[0].data.instant.details.sea_surface_wave_from_direction ?? null,
        currentSpeedMs: ts[0].data.instant.details.sea_water_speed ?? null,
        currentDirDeg: ts[0].data.instant.details.sea_water_to_direction ?? null,
        hours: ts.slice(0, 12).map((t) => ({
          at: t.time,
          waveM: t.data.instant.details.sea_surface_wave_height ?? null,
          seaTempC: t.data.instant.details.sea_water_temperature ?? null,
        })),
        licence: 'CC BY 4.0 · MET Norway',
      };
    } else {
      block.ocean = { unavailable: ocean?.__error ?? 'no data', source: 'MET Norway · Oceanforecast 2.0' };
    }
  }

  // sun / polar night
  const sun = await safe(() =>
    json(
      `https://api.met.no/weatherapi/sunrise/3.0/sun?lat=${aoi.lat}&lon=${aoi.lon}&date=${ymd()}&offset=%2B01:00`,
    ),
  );
  if (sun && sun.properties) {
    block.sun = {
      source: 'MET Norway · Sunrise 3.0',
      url: `https://api.met.no/weatherapi/sunrise/3.0/sun?lat=${aoi.lat}&lon=${aoi.lon}&date=${ymd()}&offset=%2B01:00`,
      sunrise: sun.properties.sunrise?.time ?? null,
      sunset: sun.properties.sunset?.time ?? null,
      solarNoon: sun.properties.solarnoon?.time ?? null,
      body: sun.properties.body ?? 'sun',
      // no sunrise + no sunset above the polar circle is polar night, not missing data
      polar: !sun.properties.sunrise && !sun.properties.sunset ? (Math.abs(aoi.lat) > 66.5 ? 'polar night' : 'no rise/set') : null,
    };
  } else {
    block.sun = { unavailable: sun?.__error ?? 'no data', source: 'MET Norway · Sunrise 3.0' };
  }

  // air quality (Oslo / Østfold)
  if (aoi.air) {
    const aq = await safe(() =>
      json(`https://api.met.no/weatherapi/airqualityforecast/0.1/?lat=${aoi.lat}&lon=${aoi.lon}`),
    );
    const first = aq?.data?.time?.[0];
    if (first && first.variables) {
      const v = (k) => {
        const hit = first.variables[k];
        return hit && typeof hit.value === 'number' ? Math.round(hit.value * 100) / 100 : null;
      };
      block.air = {
        source: 'MET Norway · Air Quality Forecast 0.1',
        url: `https://api.met.no/weatherapi/airqualityforecast/0.1/?lat=${aoi.lat}&lon=${aoi.lon}`,
        at: first.from ?? null,
        pm25: v('pm25_concentration'),
        pm10: v('pm10_concentration'),
        no2: v('no2_concentration'),
        ozone: v('o3_concentration'),
        aqi: v('AQI'),
        aqi_pm25: v('AQI_pm25'),
        aqi_no2: v('AQI_no2'),
        hours: (aq.data.time ?? []).slice(0, 12).map((t) => ({
          at: t.from,
          pm25: t.variables?.pm25_concentration?.value ?? null,
          aqi: t.variables?.AQI?.value ?? null,
        })),
        licence: 'CC BY 4.0 · MET Norway',
      };
    } else {
      block.air = { unavailable: aq?.__error ?? 'no data', source: 'MET Norway · Air Quality Forecast 0.1' };
    }
  }

  // aviation observation
  if (aoi.metar) {
    const metar = await safe(() =>
      fetch(`https://api.met.no/weatherapi/tafmetar/1.0/metar?icao=${aoi.metar}`, {
        headers: { 'User-Agent': UA },
      }).then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status))))),
    );
    block.metar =
      typeof metar === 'string'
        ? {
            source: `MET Norway · TAF/METAR (${aoi.metar})`,
            url: `https://api.met.no/weatherapi/tafmetar/1.0/metar?icao=${aoi.metar}`,
            raw: metar.trim().slice(0, 400) || null,
          }
        : { unavailable: metar?.__error ?? 'no data', source: 'MET Norway · TAF/METAR' };
  }

  // NVE warnings (flood + landslide). An empty array is a real answer: none issued.
  for (const [kind, base, regionKey] of [
    ['flood', 'https://api01.nve.no/hydrology/forecast/flood/v1.0.8/api/Warning', 'floodRegion'],
    ['landslide', 'https://api01.nve.no/hydrology/forecast/landslide/v1.0.8/api/Warning', 'landslideRegion'],
  ]) {
    const region = aoi[regionKey];
    if (!region) continue;
    const from = ymd();
    const to = ymd(new Date(Date.now() + 2 * 86400000));
    const warn = await safe(() => json(`${base}/${region}/${from}/${to}`));
    block[`${kind}_warnings`] = Array.isArray(warn)
      ? {
          source: `NVE · ${kind} warnings, region ${region}`,
          url: `${base}/${region}/${from}/${to}`,
          from,
          to,
          count: warn.length,
          items: warn.slice(0, 5).map((w) => ({
            region: w.RegionName ?? w.regionName ?? null,
            level: w.WarningLevel ?? w.warningLevel ?? null,
            type: w.WarningTypeName ?? w.warningTypeName ?? null,
            when: w.ValidFrom ?? w.validFrom ?? null,
            text: (w.MainText ?? w.mainText ?? '')?.slice(0, 220) ?? null,
          })),
          licence: 'NLOD · NVE',
        }
      : { unavailable: warn?.__error ?? 'no data', source: `NVE · ${kind} warnings` };
  }

  return block;
}

const started = new Date().toISOString();
console.log('norway: fetching MET Norway + NVE for', AOIS.length, 'AOIs');
const aois = [];
for (const aoi of AOIS) {
  const b = await buildAoi(aoi);
  const bits = [
    b.forecast?.now ? `now ${b.forecast.now.airTempC}°C, ${b.forecast.now.windMs} m/s` : 'forecast unavailable',
    b.ocean?.waveHeightM != null ? `wave ${b.ocean.waveHeightM} m` : null,
    b.air?.aqi != null ? `AQI ${b.air.aqi}` : null,
    b.flood_warnings ? `flood warnings ${b.flood_warnings.count ?? '—'}` : null,
    b.landslide_warnings ? `landslide warnings ${b.landslide_warnings.count ?? '—'}` : null,
  ].filter(Boolean);
  console.log(`  ${aoi.name}: ${bits.join(' · ')}`);
  aois.push(b);
}

const out = {
  domain: 'norway',
  title: 'Norwegian official data · weather, sea state, air quality, warnings',
  generated_at: started,
  provenance: {
    providers: ['MET Norway (api.met.no)', 'NVE / Varsom (api01.nve.no)'],
    licences: ['MET Norway: CC BY 4.0', 'NVE: NLOD'],
    access: 'keyless public APIs; MET Norway requires a descriptive User-Agent',
    honesty:
      'Values are copied from the API responses at generated_at. An empty warning array means NVE issued no warning for that region and window — it is not a missing fetch. Failed calls are stored with an __error field and rendered as unavailable.',
  },
  aois,
};

mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/index.json`, JSON.stringify(out, null, 1) + '\n');
console.log(`norway: wrote ${OUT}/index.json`);
