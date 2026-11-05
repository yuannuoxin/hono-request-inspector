// 通用工具：转义、请求头收集、文本化
// 这里刻意不依赖 Node 的 IncomingMessage —— 同一份代码要能跑在 Workers / Vercel 上，
// 拿不到 rawHeaders 时自动退回标准 Headers。
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

export function quote(value) {
  if (value === undefined || value === null || value === '') return '—';
  return `“${value}”`;
}

/**
 * 取请求头列表 [name, value]。
 * Node 走 incoming.rawHeaders —— 保留原始大小写、原始顺序、重复头；
 * Workers / Vercel 只有标准 Headers（键一律小写、同名头会被合并），这里如实退回。
 */
export function headerPairs(c) {
  try {
    const raw = c.env && c.env.incoming && c.env.incoming.rawHeaders;
    if (Array.isArray(raw) && raw.length) {
      const pairs = [];
      for (let i = 0; i < raw.length; i += 2) pairs.push([raw[i], raw[i + 1]]);
      return pairs;
    }
  } catch (_) {
    /* ignore */
  }
  const pairs = [];
  for (const [k, v] of c.req.raw.headers) pairs.push([k, v]);
  return pairs;
}

/** 大小写不敏感地取一个头（返回首个值） */
export function getHeader(c, name) {
  const pairs = c._headerPairs || (c._headerPairs = headerPairs(c));
  const lower = name.toLowerCase();
  const hit = pairs.find(([k]) => k.toLowerCase() === lower);
  return hit ? hit[1] : undefined;
}

export function httpVersion(c) {
  try {
    const v = c.env && c.env.incoming && c.env.incoming.httpVersion;
    if (v) return v;
  } catch (_) {
    /* ignore */
  }
  if (getHeader(c, 'cf-ray')) return '2+';
  if (getHeader(c, 'x-vercel-id')) return '2';
  return '';
}

/** 当前请求落在哪个运行时 —— 跨平台部署后一眼看出请求走到哪了 */
export function runtimeLabel(c) {
  // 先认平台标识，再认运行环境：Vercel 的 Node runtime 也满足 incoming 条件
  if (getHeader(c, 'x-vercel-id')) return 'Vercel';
  if (getHeader(c, 'cf-ray')) return 'Cloudflare';
  try {
    // Workers / Pages 都有 ASSETS binding，本地 wrangler dev 也能认出来
    if (c.env && c.env.ASSETS) return 'Cloudflare';
  } catch (_) {
    /* ignore */
  }
  try {
    const incoming = c.env && c.env.incoming;
    if (incoming && incoming.socket) return 'Node.js';
  } catch (_) {
    /* ignore */
  }
  return '未知运行时';
}

export function remoteAddress(c) {
  const cf = getHeader(c, 'cf-connecting-ip');
  if (cf) return `${cf} (Cloudflare)`;

  const xff = getHeader(c, 'x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0].trim();
    if (first) return `${first} (X-Forwarded-For)`;
  }

  const real = getHeader(c, 'x-real-ip');
  if (real) return `${real} (X-Real-IP)`;

  try {
    const addr = c.env && c.env.incoming && c.env.incoming.socket && c.env.incoming.socket.remoteAddress;
    if (addr) return `${addr} (直连)`;
  } catch (_) {
    /* ignore */
  }
  return '未知';
}

export function prettyJson(value) {
  return JSON.stringify(value, null, 2);
}

export function bytesOf(pairs) {
  let n = 0;
  for (const [k, v] of pairs) n += k.length + String(v).length + 4;
  return n;
}
