// Fetches a NASA POWER monthly snapshot (2001-2025) for ORBIT's built-in gazetteer so Earth Pulse
// works offline with REAL data labelled "snapshot". Keyless API: https://power.larc.nasa.gov
import fs from 'node:fs';
const places = JSON.parse(fs.readFileSync('src/data/gazetteer.json', 'utf8'));
const params = ['T2M', 'PRECTOTCORR', 'GWETROOT', 'ALLSKY_SFC_SW_DWN'];
const out = { source: 'NASA POWER (MERRA-2 / CERES), monthly point API, community=AG', retrieved_utc: new Date().toISOString(), start: 2001, end: 2025, params, places: {} };
for (const p of places) {
  const url = `https://power.larc.nasa.gov/api/temporal/monthly/point?parameters=${params.join(',')}&community=AG&longitude=${p.lon}&latitude=${p.lat}&start=2001&end=2025&format=JSON`;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    out.places[p.id] = { url, parameter: j.properties.parameter, units: Object.fromEntries(params.map((k) => [k, j.parameters?.[k]?.units ?? null])) };
    console.log('ok', p.id);
  } catch (e) {
    console.log('fail', p.id, e.message);
  }
}
fs.writeFileSync('public/data/power-snapshot.json', JSON.stringify(out));
