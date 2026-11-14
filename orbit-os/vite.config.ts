import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Optional LLM proxy. Keeps ORBIT_LLM_API_KEY server-side (dev + preview server only).
 * GET  /api/llm/status -> { configured, model }
 * POST /api/llm/chat   -> { content }   body: { system, user }
 */
function orbitLlm(env: Record<string, string>): Plugin {
  const key = env.ORBIT_LLM_API_KEY || '';
  const base = (env.ORBIT_LLM_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = env.ORBIT_LLM_MODEL || 'gpt-4o-mini';
  const handler = async (req: any, res: any, next: any) => {
    if (!req.url?.startsWith('/api/llm')) return next();
    res.setHeader('Content-Type', 'application/json');
    if (req.url.startsWith('/api/llm/status')) {
      res.end(JSON.stringify({ configured: !!key, model: key ? model : null }));
      return;
    }
    if (req.url.startsWith('/api/llm/chat') && req.method === 'POST') {
      if (!key) {
        res.statusCode = 503;
        res.end(JSON.stringify({ error: 'LLM not configured' }));
        return;
      }
      let body = '';
      req.on('data', (c: Buffer) => (body += c));
      req.on('end', async () => {
        try {
          const { system, user } = JSON.parse(body || '{}');
          const r = await fetch(`${base}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
            body: JSON.stringify({ model, temperature: 0, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
          });
          const j: any = await r.json();
          if (!r.ok) throw new Error(j?.error?.message || `HTTP ${r.status}`);
          res.end(JSON.stringify({ content: j.choices?.[0]?.message?.content ?? '' }));
        } catch (e: any) {
          res.statusCode = 502;
          res.end(JSON.stringify({ error: String(e?.message || e) }));
        }
      });
      return;
    }
    next();
  };
  return {
    name: 'orbit-llm-proxy',
    configureServer(s) { s.middlewares.use(handler); },
    configurePreviewServer(s) { s.middlewares.use(handler); },
  };
}

/**
 * Secure connector proxy. Credentials live ONLY in server-side .env
 * (ORBIT_EARTHDATA_USER/PASS, ORBIT_CDSE_CLIENT_ID/SECRET, ORBIT_SENTINEL_HUB_TOKEN,
 * ORBIT_OPENTOPOGRAPHY_KEY); the browser calls /api/connector/* and never sees a secret.
 *   GET /api/connector/status   -> which connectors are configured
 *   GET /api/connector/asf/*    -> ASF Search API (keyless) — real NISAR/Sentinel scenes
 *   GET /api/connector/cmr/*    -> NASA CMR (keyless) metadata
 *   GET /api/connector/earthdata/* -> CMR with Earthdata basic auth (if configured)
 */
function orbitConnectors(env: Record<string, string>): Plugin {
  const configured = {
    earthdata: !!(env.ORBIT_EARTHDATA_USER && env.ORBIT_EARTHDATA_PASS),
    cdse: !!(env.ORBIT_CDSE_CLIENT_ID && env.ORBIT_CDSE_CLIENT_SECRET),
    sentinelHub: !!env.ORBIT_SENTINEL_HUB_TOKEN,
    opentopography: !!env.ORBIT_OPENTOPOGRAPHY_KEY,
  };

  const json = (res: any, code: number, body: unknown) => {
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(body));
  };

  const proxy = async (res: any, base: string, path: string, headers: Record<string, string> = {}) => {
    try {
      const r = await fetch(base + path, {
        headers: { 'User-Agent': 'ORBIT-OS/1.0 (NASA Space Apps)', ...headers },
      });
      res.statusCode = r.status;
      res.setHeader('Content-Type', r.headers.get('content-type') || 'application/json');
      res.end(await r.text());
    } catch (e: any) {
      json(res, 502, { error: String(e?.message || e) });
    }
  };

  const handler = async (req: any, res: any, next: any) => {
    if (!req.url?.startsWith('/api/connector')) return next();
    const url = new URL(req.url, 'http://localhost');

    if (url.pathname === '/api/connector/status') {
      return json(res, 200, {
        asf: { configured: true, keyless: true, note: 'keyless NISAR / Sentinel search' },
        cmr: { configured: true, keyless: true, note: 'keyless metadata' },
        earthdata: { configured: configured.earthdata, keyless: false, note: configured.earthdata ? 'authenticated (basic auth)' : 'set ORBIT_EARTHDATA_USER + ORBIT_EARTHDATA_PASS' },
        cdse: { configured: configured.cdse, keyless: false, note: configured.cdse ? 'authenticated' : 'set ORBIT_CDSE_CLIENT_ID + ORBIT_CDSE_CLIENT_SECRET' },
        sentinelHub: { configured: configured.sentinelHub, keyless: false, note: configured.sentinelHub ? 'token loaded' : 'set ORBIT_SENTINEL_HUB_TOKEN' },
        opentopography: { configured: configured.opentopography, keyless: false, note: configured.opentopography ? 'key loaded' : 'set ORBIT_OPENTOPOGRAPHY_KEY' },
      });
    }

    if (url.pathname.startsWith('/api/connector/asf')) {
      const path = url.pathname.replace('/api/connector/asf', '') + url.search;
      return proxy(res, 'https://api.daac.asf.alaska.edu', path);
    }

    if (url.pathname.startsWith('/api/connector/earthdata')) {
      if (!configured.earthdata) return json(res, 503, { error: 'Earthdata credentials not configured' });
      const auth = 'Basic ' + Buffer.from(`${env.ORBIT_EARTHDATA_USER}:${env.ORBIT_EARTHDATA_PASS}`).toString('base64');
      const path = url.pathname.replace('/api/connector/earthdata', '') + url.search;
      return proxy(res, 'https://cmr.earthdata.nasa.gov', path, { Authorization: auth });
    }

    if (url.pathname.startsWith('/api/connector/cmr')) {
      const path = url.pathname.replace('/api/connector/cmr', '') + url.search;
      return proxy(res, 'https://cmr.earthdata.nasa.gov', path);
    }

    json(res, 404, { error: 'unknown connector' });
  };

  return {
    name: 'orbit-connectors',
    configureServer(s) { s.middlewares.use(handler); },
    configurePreviewServer(s) { s.middlewares.use(handler); },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'ORBIT_');
  return {
    plugins: [react(), orbitLlm(env), orbitConnectors(env)],
    server: { port: 5173, host: true },
    build: {
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('/node_modules/three/')) return 'three-vendor';
            if (/\/node_modules\/(react-globe\.gl|globe\.gl|three-globe|three-render-objects|3d-tiles-renderer)\//.test(id)) return 'globe-vendor';
          },
        },
      },
    },
  };
});
