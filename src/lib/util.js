// 通用工具：转义、请求头收集、文本化
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

/** 取 Node 原始请求头（保留重复头的顺序与大小写），失败时退回 Headers 迭代 */
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
    return c.env.incoming.httpVersion;
  } catch (_) {
    return '';
  }
}

export function remoteAddress(c) {
  const local = () => {
    try {
      return c.env.incoming.socket.remoteAddress;
    } catch (_) {
      return '';
    }
  };
  const xff = getHeader(c, 'x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0].trim();
    if (first) return `${first} (via X-Forwarded-For)`;
  }
  return local() || '未知';
}

export function prettyJson(value) {
  return JSON.stringify(value, null, 2);
}

export function bytesOf(pairs) {
  let n = 0;
  for (const [k, v] of pairs) n += k.length + String(v).length + 4;
  return n;
}
