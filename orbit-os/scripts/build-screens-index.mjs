/**
 * Builds the screen map: screens/manifest.json + screens/README.md + screens/index.html
 *
 * Input:  screens/_capture.json (written by capture-screens.mjs), the challenge
 *         table and the module→challenge mapping in src/data/.
 * Output: one gallery organised by problem/use case, with each screen linked.
 *
 *   node scripts/build-screens-index.mjs
 */
import { readFile, writeFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCREENS_DIR = join(ROOT, '..', 'screens');

const PLATFORM_GROUPS = [
  {
    id: 'platform-start',
    title: 'Start here · Command Center',
    summary: 'The one change engine: live counters, quick investigation, the four priority modules and the data-coverage footer.',
    screens: ['command-center'],
  },
  {
    id: 'platform-unified',
    title: 'One Earth · Unified Geospatial',
    summary: 'Agriculture and ocean indicators side by side on one globe, from one NASA Earthdata path — with not-connected tiles instead of invented ones.',
    screens: ['unified-earth', 'explore'],
  },
  {
    id: 'platform-evidence',
    title: 'Earthdata → Evidence · access and verification',
    summary: 'The authentication path, the readiness checklist driven by real probes, and the catalog the harvest actually returned.',
    screens: ['earthdata-access', 'earthdata-command', 'verification'],
  },
  {
    id: 'platform-data',
    title: 'Data layer · hub, agents, exports',
    summary: 'Every dataset with its status and coverage, the seven deterministic agents, the domain files, and the settings that switch live/snapshot.',
    screens: ['data-hub', 'ai-agents', 'settings'],
  },
  {
    id: 'platform-program',
    title: 'Program · missions, solutions, SDGs, reports',
    summary: 'The challenge catalogue, the 14 prototypes, the UN SDG mapping and the generated evidence reports.',
    screens: ['missions', 'solutions', 'sdgs', 'reports'],
  },
  {
    id: 'platform-beyond',
    title: 'Beyond the 14 · GNSS integrity & situation room',
    summary: 'Two ORBIT surfaces that are not tied to a single challenge: GNSS integrity assessment (real GnssLogger/NMEA parsing) and a live Earth situation room.',
    screens: ['module-gnss', 'module-defense'],
  },
  {
    id: 'platform-twin',
    title: 'Digital twin · Arctic Watch',
    summary: 'The 3D Earth twin and the embedded Arctic Watch sibling app.',
    screens: ['digital-twin', 'arctic-watch', 'analysis'],
  },
];

function parseChallengeTable(src) {
  const out = [];
  const re = /\{ n: (\d+), name: '([^']+)', file: '([^']+)' \}/g;
  let m;
  while ((m = re.exec(src))) out.push({ n: Number(m[1]), name: m[2], file: m[3] });
  return out;
}

function parseChallengeMeta(src) {
  const out = {};
  const re = /(\d+): \{ difficulty: '([^']+)', subjects: \[([^\]]*)\], desc: '((?:[^'\\]|\\.)*)' \}/g;
  let m;
  while ((m = re.exec(src))) out[Number(m[1])] = { difficulty: m[2], subjects: m[3].replace(/['"]/g, '').split(',').map((s) => s.trim()).filter(Boolean), desc: m[4].replace(/\\'/g, "'") };
  return out;
}

function parseModules(src) {
  const out = [];
  const re = /\{ id: '([a-z]+)', name: '([^']+)', icon: '[^']+', tagline: '((?:[^'\\]|\\.)*)'[\s\S]*?release: '(P\d)'[\s\S]*?challenges: \[([0-9,\s]*)\]/g;
  let m;
  while ((m = re.exec(src))) {
    out.push({
      id: m[1],
      name: m[2],
      tagline: m[3].replace(/\\'/g, "'").replace(/\\\\/g, '\\'),
      release: m[4],
      challenges: m[5].split(',').map((x) => Number(x.trim())).filter(Boolean),
    });
  }
  return out;
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function main() {
  const captureSrc = await readFile(join(ROOT, 'scripts', 'capture-screens.mjs'), 'utf8');
  const table = [...captureSrc.matchAll(/\{ slug: '([a-z0-9\-]+)', route: '([^']+)', title: '([^']+)' \}/g)].map((m) => ({ slug: m[1], route: m[2], title: m[3] }));
  for (let i = 1; i <= 14; i++) table.push({ slug: `solution-${String(i).padStart(2, '0')}`, route: `/solution/${i}`, title: `Challenge ${i} prototype` });

  const screens = [];
  for (const t of table) {
    const file = join(SCREENS_DIR, 'pages', `${t.slug}.jpg`);
    try {
      const st = await stat(file);
      screens.push({ ...t, file: `${t.slug}.jpg`, bytes: st.size, mtime: st.mtime.toISOString() });
    } catch {
      /* not captured */
    }
  }
  const capture = { screens, base: 'http://localhost:5173/', captured_at: screens[0]?.mtime ?? new Date().toISOString() };

  const modulesSrc = await readFile(join(ROOT, 'src', 'data', 'modules.ts'), 'utf8');
  const metaSrc = await readFile(join(ROOT, 'src', 'data', 'challenges.ts'), 'utf8');
  const challenges = parseChallengeTable(modulesSrc);
  const meta = parseChallengeMeta(metaSrc);
  const modules = parseModules(modulesSrc);

  const bySlug = new Map(capture.screens.map((s) => [s.slug, s]));
  const missing = [];

  const ref = (slug, role) => {
    const s = bySlug.get(slug);
    if (!s) {
      missing.push(slug);
      return null;
    }
    return { slug, title: s.title, route: s.route, file: `pages/${s.file}`, role };
  };

  // ---- use cases: the 14 challenges, each with its prototype + implementing modules
  const challengeCases = challenges.map((c) => {
    const impl = modules.filter((m) => m.challenges.includes(c.n));
    const links = [
      ref(`solution-${String(c.n).padStart(2, '0')}`, 'challenge prototype (sample data)'),
      ...impl.map((m) => ref(`module-${m.id}`, `implementing module · ${m.release}`)),
    ].filter(Boolean);
    return {
      id: `challenge-${String(c.n).padStart(2, '0')}`,
      kind: 'challenge',
      number: c.n,
      title: `Challenge ${c.n} · ${c.name}`,
      summary: meta[c.n]?.desc ?? '',
      difficulty: meta[c.n]?.difficulty ?? '',
      subjects: meta[c.n]?.subjects ?? [],
      screens: links,
    };
  });

  const fill = (list) => list.map((slug) => ref(slug, 'platform surface')).filter(Boolean);
  const platformCases = PLATFORM_GROUPS.map((g) => ({
    id: g.id,
    kind: 'platform',
    title: g.title,
    summary: g.summary,
    screens: fill(g.screens),
  }));

  const useCases = [...platformCases, ...challengeCases];
  const usedSlugs = new Set(useCases.flatMap((u) => u.screens.map((s) => s.slug)));
  const orphans = capture.screens.filter((s) => !usedSlugs.has(s.slug)).map((s) => ({ slug: s.slug, title: s.title, route: s.route, file: `pages/${s.file}`, role: 'uncategorised' }));

  const manifest = {
    generated_at: new Date().toISOString(),
    app: 'ORBIT OS · Space Intelligence Platform',
    base_url: capture.base,
    capture: { width: 1440, viewport_height: 2200, format: 'jpeg q80', count: capture.screens.length },
    screens: capture.screens.map((s) => ({ slug: s.slug, title: s.title, route: s.route, file: `pages/${s.file}`, bytes: s.bytes, captured_at: s.mtime })),
    useCases,
    uncategorised: orphans,
    notes: [
      'Every screenshot was captured from the running app, not composed.',
      'A screen can serve several use cases; the canonical file lives in pages/ and is linked from each case.',
      'Sample vs live is visible in the UI: unfetched products render as "not connected" with no number.',
    ],
  };

  await writeFile(join(SCREENS_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

  // ---- README.md
  const md = [];
  md.push('# ORBIT OS — screen map');
  md.push('');
  md.push(`${capture.screens.length} screens captured on ${new Date(capture.captured_at).toLocaleString('en-GB', { hour12: false })} from \`${capture.base}\` at 1440 px, JPEG q80.`);
  md.push('');
  md.push('Screens live once in `pages/`; each use case below links to the ones that prove it.');
  md.push('');
  for (const u of useCases) {
    md.push(`## ${u.title}`);
    if (u.summary) md.push('', `> ${u.summary}`);
    if (u.difficulty) md.push('', `*${u.difficulty}${u.subjects?.length ? ' · ' + u.subjects.join(', ') : ''}*`);
    md.push('');
    md.push('| Screen | Route | Role | Screenshot |');
    md.push('| --- | --- | --- | --- |');
    for (const s of u.screens) md.push(`| ${s.title} | \`#${s.route}\` | ${s.role} | [\`${s.slug}.jpg\`](${s.file}) |`);
    md.push('');
  }
  if (orphans.length) {
    md.push('## Uncategorised');
    md.push('');
    for (const o of orphans) md.push(`- ${o.title} (\`#${o.route}\`) — [${o.slug}.jpg](pages/${o.slug}.jpg)`);
    md.push('');
  }
  await writeFile(join(SCREENS_DIR, 'README.md'), md.join('\n'));

  // ---- index.html gallery
  const nav = useCases.map((u) => `<a href="#${u.id}">${esc(u.title.replace(/^Challenge (\d+) · /, 'C$1 · '))}</a>`).join('');
  const sections = useCases.map((u) => `
    <section id="${u.id}">
      <header class="uc">
        <div class="tag">${u.kind === 'challenge' ? 'challenge' : 'platform'}</div>
        <h2>${esc(u.title)}</h2>
        ${u.summary ? `<p class="summary">${esc(u.summary)}</p>` : ''}
        ${u.difficulty ? `<p class="meta">${esc(u.difficulty)}${u.subjects?.length ? ' · ' + esc(u.subjects.join(', ')) : ''}</p>` : ''}
      </header>
      <div class="grid">
        ${u.screens.map((s) => `
        <figure>
          <a href="${s.file}" target="_blank" rel="noreferrer"><img src="${s.file}" alt="${esc(s.title)}" loading="lazy" /></a>
          <figcaption>
            <b>${esc(s.title)}</b>
            <span class="route">#${esc(s.route)}</span>
            <span class="role">${esc(s.role)}</span>
          </figcaption>
        </figure>`).join('')}
      </div>
    </section>`).join('');

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>ORBIT OS — screen map</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #04070f; color: #e6eefb; font: 14px/1.5 "Inter", "Segoe UI", system-ui, sans-serif; }
  a { color: #7dd3fc; }
  .wrap { max-width: 1500px; margin: 0 auto; padding: 32px 24px 80px; }
  h1 { font-size: 28px; margin: 0 0 4px; letter-spacing: -0.01em; }
  .sub { color: #94a3b8; margin: 0 0 18px; }
  nav { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 28px; }
  nav a { font-size: 11px; padding: 4px 8px; border: 1px solid rgba(148,163,184,.25); border-radius: 999px; text-decoration: none; color: #cbd5e1; }
  nav a:hover { border-color: #38bdf8; color: #e0f2fe; }
  section { margin: 0 0 44px; scroll-margin-top: 16px; }
  .uc { border-left: 2px solid rgba(56,189,248,.45); padding-left: 12px; margin-bottom: 14px; }
  .tag { display: inline-block; font-size: 9px; letter-spacing: .14em; text-transform: uppercase; color: #38bdf8; }
  h2 { font-size: 19px; margin: 2px 0 4px; }
  .summary { color: #cbd5e1; margin: 0; max-width: 100ch; }
  .meta { color: #64748b; font-size: 11px; margin: 4px 0 0; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(430px, 1fr)); gap: 14px; }
  figure { margin: 0; background: #0a1120; border: 1px solid rgba(148,163,184,.18); border-radius: 12px; overflow: hidden; }
  figure img { display: block; width: 100%; height: auto; }
  figcaption { padding: 8px 10px 10px; display: flex; flex-direction: column; gap: 2px; font-size: 12px; }
  .route { color: #7dd3fc; font-family: ui-monospace, monospace; font-size: 11px; }
  .role { color: #94a3b8; font-size: 11px; }
  footer { color: #64748b; font-size: 11px; border-top: 1px solid rgba(148,163,184,.15); padding-top: 12px; }
</style></head>
<body><div class="wrap">
  <h1>ORBIT OS — screen map</h1>
  <p class="sub">${capture.screens.length} screens captured from the running app · ${new Date(capture.captured_at).toLocaleString('en-GB', { hour12: false })} · 1440 px · organised by problem use case</p>
  <nav>${nav}</nav>
  ${sections}
  <footer>Canonical screenshots live in <code>pages/</code>. Rebuild with <code>node scripts/capture-screens.mjs &amp;&amp; node scripts/build-screens-index.mjs</code>. Unfetched products are rendered as “not connected” in the UI rather than fabricated.</footer>
</div></body></html>`;
  await writeFile(join(SCREENS_DIR, 'index.html'), html);

  console.log(`manifest: ${capture.screens.length} screens · ${useCases.length} use cases · orphans ${orphans.length}`);
  if (missing.length) console.log('MISSING (not captured):', [...new Set(missing)].join(', '));
}

main().catch((e) => {
  console.error('index build failed:', e.message);
  process.exit(1);
});
