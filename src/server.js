import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';

import { REQUEST_HINTS } from './lib/hints.js';
import { headerPairs, httpVersion, remoteAddress, getHeader } from './lib/util.js';
import { overviewView } from './views/overview.js';
import { uaView } from './views/ua.js';
import { hintsView } from './views/hints.js';
import { headersView } from './views/headers.js';
import { fingerprintView } from './views/fingerprint.js';

const app = new Hono();

app.use('*', logger());

// 静态资源 /static/* -> ./public/*
app.use(
  '/static/*',
  serveStatic({
    root: './public',
    rewriteRequestPath: (p) => p.replace(/^\/static/, ''),
  }),
);

// 所有响应都带上 Client Hints 协商头：
// Accept-CH 决定了“下一次请求”会带哪些高熵提示，
// Critical-CH 让浏览器发现关键提示缺失时立刻重发一次请求补齐。
const CH_LIST = REQUEST_HINTS.join(', ');
app.use('*', async (c, next) => {
  c.header('Accept-CH', CH_LIST);
  c.header('Critical-CH', CH_LIST);
  c.header('Vary', CH_LIST);
  await next();
});

app.get('/', (c) => c.html(overviewView(c)));
app.get('/ua', (c) => c.html(uaView(c)));
app.get('/client-hints', (c) => c.html(hintsView(c)));
app.get('/headers', (c) => c.html(headersView(c)));
app.get('/fingerprint', (c) => c.html(fingerprintView(c)));

// 供 /headers 页面做“导航请求 vs fetch 请求”对比
app.get('/api/headers', (c) => {
  const pairs = headerPairs(c);
  return c.json({
    method: c.req.method,
    path: c.req.path,
    httpVersion: httpVersion(c),
    remote: remoteAddress(c),
    headerCount: pairs.length,
    headers: Object.fromEntries(pairs.map(([k, v]) => [k.toLowerCase(), v])),
    rawPairs: pairs,
  });
});

// ---------------------------------------------------------------------------
// FingerprintJS v5 结果归档：按 visitorId 记录访问次数与组件漂移
// ---------------------------------------------------------------------------
const fpStore = new Map(); // visitorId -> { visits, firstSeen, lastSeen, components, ua }
const FP_STORE_LIMIT = 500;

function pruneStore() {
  if (fpStore.size <= FP_STORE_LIMIT) return;
  const oldest = [...fpStore.entries()].sort((a, b) => a[1].lastSeen - b[1].lastSeen)[0];
  if (oldest) fpStore.delete(oldest[0]);
}

function normalizeComponents(input) {
  if (!input || typeof input !== 'object') return {};
  const out = {};
  for (const [key, entry] of Object.entries(input)) {
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(key)) continue;
    const value = entry && typeof entry === 'object' ? entry.value : entry;
    out[key] = value;
  }
  return out;
}

app.post('/api/fingerprint', async (c) => {
  let body;
  try {
    body = await c.req.json();
  } catch (_) {
    return c.json({ ok: false, error: '请求体不是合法 JSON' }, 400);
  }

  const visitorId = String((body && body.visitorId) || '').trim();
  if (!/^[a-zA-Z0-9]{8,64}$/.test(visitorId)) {
    return c.json({ ok: false, error: 'visitorId 格式不合法' }, 400);
  }

  const components = normalizeComponents(body.components);
  const now = Date.now();
  const ua = getHeader(c, 'user-agent') || '';
  const prev = fpStore.get(visitorId);

  const changed = [];
  if (prev) {
    const keys = new Set([...Object.keys(prev.components), ...Object.keys(components)]);
    for (const key of keys) {
      const before = JSON.stringify(prev.components[key] ?? null);
      const after = JSON.stringify(components[key] ?? null);
      if (before !== after) {
        changed.push({ key, from: prev.components[key] ?? null, to: components[key] ?? null });
      }
    }
  }

  const record = {
    visits: (prev ? prev.visits : 0) + 1,
    firstSeen: prev ? prev.firstSeen : now,
    lastSeen: now,
    components,
    ua,
  };
  fpStore.set(visitorId, record);
  pruneStore();

  const sameUaIds = new Set([...fpStore.entries()].filter(([, r]) => r.ua === ua).map(([id]) => id));

  return c.json({
    ok: true,
    visitorId,
    visits: record.visits,
    firstSeen: record.firstSeen,
    lastSeen: record.lastSeen,
    changed,
    stable: prev ? changed.length === 0 : true,
    componentCount: Object.keys(components).length,
    totalVisitors: fpStore.size,
    sameUaVisitorCount: sameUaIds.size,
    confidence: typeof body.confidence === 'number' ? body.confidence : null,
  });
});

app.notFound((c) => c.text('404 Not Found', 404));

const port = Number(process.env.PORT || 3000);
const hostname = process.env.HOST || '127.0.0.1';

serve({ fetch: app.fetch, port, hostname }, (info) => {
  console.log(`\n  Hono Request Inspector 已启动`);
  console.log(`  → http://localhost:${info.port}`);
  console.log(`  → UA 解析        http://localhost:${info.port}/ua`);
  console.log(`  → Client Hints   http://localhost:${info.port}/client-hints`);
  console.log(`  → 请求头全量      http://localhost:${info.port}/headers`);
  console.log(`  → Fingerprint v5 http://localhost:${info.port}/fingerprint\n`);
});
