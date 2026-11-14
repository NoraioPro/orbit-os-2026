// Copies the generated asset pack (../assets or ORBIT_ASSETS_DIR) into public/assets so Vite serves it at /assets/.
import fs from 'node:fs';
import path from 'node:path';
const src = path.resolve(process.argv[2] || process.env.ORBIT_ASSETS_DIR || '../assets');
const dst = path.resolve('public/assets');
if (!fs.existsSync(path.join(src, 'manifest.json'))) { console.error(`No asset manifest at ${src}; keeping placeholders.`); process.exit(0); }
fs.cpSync(src, dst, { recursive: true });
console.log(`copied ${src} -> ${dst}`);
