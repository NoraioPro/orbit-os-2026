/**
 * Capture one screenshot per ORBIT screen.
 *
 * Driven over CDP against the running dev server (:5173). Writes JPEGs into
 * the project's screens/pages/ folder, named by slug, and prints a JSON summary
 * the gallery builder consumes.
 *
 *   node scripts/capture-screens.mjs            (dev server must be up)
 *   node scripts/capture-screens.mjs oslo|...   (optional: only these slugs)
 */
import { spawn } from 'node:child_process';
import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, '..', 'screens', 'pages');
const PORT = 9360;
const BASE = 'http://localhost:5173/';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

export const SCREENS = [
  { slug: 'command-center', route: '/', title: 'Command Center' },
  { slug: 'unified-earth', route: '/unified', title: 'Unified Geospatial (Agri × Ocean)' },
  { slug: 'explore', route: '/explore', title: 'Explore' },
  { slug: 'analysis', route: '/analysis', title: 'Analysis' },
  { slug: 'digital-twin', route: '/twin', title: 'Digital Twin' },
  { slug: 'data-hub', route: '/data', title: 'Data Hub' },
  { slug: 'earthdata-access', route: '/earthdata', title: 'Earthdata access path' },
  { slug: 'earthdata-command', route: '/command', title: 'NASA Earthdata Command' },
  { slug: 'verification', route: '/verify', title: 'Data access verification' },
  { slug: 'missions', route: '/missions', title: 'Missions' },
  { slug: 'solutions', route: '/solutions', title: 'Solutions (14 prototypes)' },
  { slug: 'sdgs', route: '/sdgs', title: 'SDG map' },
  { slug: 'reports', route: '/reports', title: 'Reports' },
  { slug: 'ai-agents', route: '/agents', title: 'AI Agents' },
  { slug: 'settings', route: '/settings', title: 'Settings' },
  { slug: 'arctic-watch', route: '/arctic', title: 'Arctic Watch (embedded)' },
  { slug: 'module-earth', route: '/module/earth', title: 'Earth Intelligence' },
  { slug: 'module-disaster', route: '/module/disaster', title: 'Disaster Watch' },
  { slug: 'module-agri', route: '/module/agri', title: 'Agri Intelligence' },
  { slug: 'module-ocean', route: '/module/ocean', title: 'Ocean Intelligence' },
  { slug: 'module-infrastructure', route: '/module/infrastructure', title: 'Infrastructure' },
  { slug: 'module-gnss', route: '/module/gnss', title: 'GNSS Guardian' },
  { slug: 'module-autonomy', route: '/module/autonomy', title: 'Autonomy Lab' },
  { slug: 'module-explorer', route: '/module/explorer', title: 'Space Explorer' },
  { slug: 'module-academy', route: '/module/academy', title: 'Mission Academy' },
  { slug: 'module-human', route: '/module/human', title: 'Human Space Lab' },
  { slug: 'module-ignis', route: '/module/ignis', title: 'IGNIS · Flame in Freefall' },
  { slug: 'module-sar', route: '/module/sar', title: 'SAR Earth Observatory' },
  { slug: 'module-defense', route: '/module/defense', title: 'Defense & Crisis' },
  ...Array.from({ length: 14 }).map((_, i) => ({
    slug: `solution-${String(i + 1).padStart(2, '0')}`,
    route: `/solution/${i + 1}`,
    title: `Challenge ${i + 1} prototype`,
  })),
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdp(ws, method, params = {}) {
  return new Promise((resolve) => {
    const id = Math.floor(Math.random() * 1e9);
    const onMsg = (e) => {
      const m = JSON.parse(e.data);
      if (m.id === id) {
        ws.removeEventListener('message', onMsg);
        resolve(m.result);
      }
    };
    ws.addEventListener('message', onMsg);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const only = process.argv.slice(2);
  const list = only.length ? SCREENS.filter((s) => only.includes(s.slug)) : SCREENS;

  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
    `--remote-debugging-port=${PORT}`, '--window-size=1440,1000', `${BASE}#/`,
  ], { stdio: 'ignore' });

  try {
    await sleep(4000);
    let wsUrl = null;
    for (let i = 0; i < 20 && !wsUrl; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
        const targets = await res.json();
        wsUrl = targets.find((t) => t.type === 'page')?.webSocketDebuggerUrl ?? null;
      } catch {
        /* not up yet */
      }
      if (!wsUrl) await sleep(700);
    }
    if (!wsUrl) throw new Error('no CDP page target');

    const ws = new WebSocket(wsUrl);
    await new Promise((r) => ws.addEventListener('open', r, { once: true }));
    await cdp(ws, 'Page.enable');
    await cdp(ws, 'Runtime.enable');

    const done = [];
    for (const s of list) {
      // full document per screen: in-page hash changes accumulate state and the
      // three.js canvases eventually stop painting in headless.
      await cdp(ws, 'Emulation.setDeviceMetricsOverride', { width: 1440, height: 2200, deviceScaleFactor: 1, mobile: false });
      await cdp(ws, 'Page.navigate', { url: `${BASE}#${s.route}` });
      await sleep(6500);
      const ready = await cdp(ws, 'Runtime.evaluate', {
        expression: `(() => { const m = document.querySelector('main'); return m ? (m.innerText || '').trim().length : 0; })()`,
        returnByValue: true,
      });
      let textLen = Number(ready?.result?.value ?? 0);
      if (textLen < 40) {
        // one retry with a hard reload
        await cdp(ws, 'Page.reload', { ignoreCache: true });
        await sleep(6500);
        const again = await cdp(ws, 'Runtime.evaluate', {
          expression: `(() => { const m = document.querySelector('main'); return m ? (m.innerText || '').trim().length : 0; })()`,
          returnByValue: true,
        });
        textLen = Number(again?.result?.value ?? 0);
      }
      const shot = await cdp(ws, 'Page.captureScreenshot', { format: 'jpeg', quality: 80, captureBeyondViewport: true });
      if (!shot?.data) {
        console.log(`  ! ${s.slug}: no data`);
        continue;
      }
      const bytes = Math.round((shot.data.length * 3) / 4);
      const file = join(OUT, `${s.slug}.jpg`);
      await writeFile(file, Buffer.from(shot.data, 'base64'));
      const ok = textLen >= 40 && bytes > 20000;
      done.push({ ...s, file: `${s.slug}.jpg`, height: 2200, bytes, textLen, ok });
      console.log(`  ${ok ? '✓' : '!'} ${s.slug} (${Math.round(bytes / 1024)} KB, ${textLen} chars)`);
    }

    await writeFile(join(ROOT, '..', 'screens', '_capture.json'), JSON.stringify({ captured_at: new Date().toISOString(), base: BASE, screens: done }, null, 2));
    console.log(`captured ${done.length}/${list.length}`);
    ws.close();
    process.exitCode = done.length === list.length ? 0 : 1;
  } finally {
    // a child that already exited throws on kill(); that must not fail the run
    try {
      chrome.kill();
    } catch {
      /* already gone */
    }
  }
}

main().catch((e) => {
  console.error('capture failed:', e.message);
  process.exit(1);
});
