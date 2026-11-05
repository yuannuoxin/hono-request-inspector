// 平台无关的 Hono 应用：Node / Cloudflare Workers / Cloudflare Pages / Vercel 共用
// 这里不要 import 任何 Node 专属 API（@hono/node-server、process.env、incoming 等），
// 平台差异通过 createApp 的 mountStatic 回调注入。
import { Hono } from 'hono';
import { logger } from 'hono/logger';

import { REQUEST_HINTS } from './lib/hints.js';
import { headerPairs, httpVersion, remoteAddress, getHeader } from './lib/util.js';
import { overviewView } from './views/overview.js';
import { uaView } from './views/ua.js';
import { hintsView } from './views/hints.js';
import { headersView } from './views/headers.js';
import { fingerprintView } from './views/fingerprint.js';

const CH_LIST = REQUEST_HINTS.join(', ');

// FingerprintJS 结果归档。注意：内存 Map 只在当前进程 / 当前 isolate 内有效，
// serverless 环境下实例重启或多副本之间不会共享，仅适合演示。
const fpStore = new Map();
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

/**
 * @param {object} [options]
 * @param {(app: Hono) => void} [options.mountStatic] 注册 /static/* 的静态资源处理（各平台不同）
 */
export function createApp(options = {}) {
  const app = new Hono();

  app.use('*', logger());

  // 所有响应都带上 Client Hints 协商头：
  // Accept-CH 决定了“下一次请求”会带哪些高熵提示，
  // Critical-CH 让浏览器发现关键提示缺失时立刻重发一次请求补齐。
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

  // 静态资源由各平台自己提供，这里只留一个挂载点
  if (typeof options.mountStatic === 'function') {
    options.mountStatic(app);
  }

  app.notFound((c) => c.text('404 Not Found', 404));

  return app;
}
