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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'ORBIT_');
  return {
    plugins: [react(), orbitLlm(env)],
    server: { port: 5173, host: true },
    build: { chunkSizeWarningLimit: 2500 },
  };
});
