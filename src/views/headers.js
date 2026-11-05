// 请求头全量页
import { card, codeBlock, layout, pill } from './layout.js';
import { bytesOf, esc, headerPairs, httpVersion, remoteAddress, prettyJson } from '../lib/util.js';

const GROUP_RULES = [
  { id: 'all', label: '全部', test: () => true },
  { id: 'ch', label: 'Client Hints', test: (k) => k.startsWith('sec-ch-') },
  { id: 'fetch', label: 'Sec-Fetch', test: (k) => k.startsWith('sec-fetch-') },
  { id: 'accept', label: 'Accept 系列', test: (k) => k.startsWith('accept') },
  { id: 'cookie', label: 'Cookie', test: (k) => k === 'cookie' },
  { id: 'proxy', label: '代理 / 转发', test: (k) => /^(x-|forwarded$|via$|cf-)/.test(k) },
];

export function headersView(c) {
  const pairs = headerPairs(c);
  const bytes = bytesOf(pairs);

  const payload = {
    method: c.req.method,
    path: c.req.path,
    query: c.req.url.split('?')[1] || '',
    httpVersion: httpVersion(c),
    remote: remoteAddress(c),
    headerCount: pairs.length,
    headers: Object.fromEntries(pairs.map(([k, v]) => [k.toLowerCase(), v])),
    rawPairs: pairs,
  };

  const groupButtons = GROUP_RULES.map(
    (g, i) =>
      `<button class="btn filter-btn${i === 0 ? ' is-on' : ''}" type="button" data-filter="${g.id}">${esc(g.label)}</button>`,
  ).join('');

  const table = `<table class="data" id="headers-table">
  <thead><tr><th style="width:44px">#</th><th style="width:260px">请求头</th><th>值</th></tr></thead>
  <tbody>
  ${pairs
    .map(
      ([k, v], i) => `<tr data-name="${esc(k.toLowerCase())}">
      <td class="mono" style="color:var(--dim)">${i + 1}</td>
      <td class="key-cell">${esc(k)}</td>
      <td class="value-cell">${esc(v)}</td>
    </tr>`,
    )
    .join('')}
  </tbody>
</table>
<div class="empty" id="headers-empty" style="display:none">没有匹配的请求头。</div>`;

  const stats = `<div class="stats">
  <div class="stat"><div class="stat-label">请求</div><div class="stat-value mono">${c.req.method} ${esc(c.req.path)}</div></div>
  <div class="stat"><div class="stat-label">请求头数量</div><div class="stat-value">${pairs.length}</div></div>
  <div class="stat"><div class="stat-label">头体积</div><div class="stat-value">≈ ${bytes} 字节</div></div>
  <div class="stat"><div class="stat-label">远端地址</div><div class="stat-value mono">${esc(remoteAddress(c))}</div></div>
</div>`;

  const listCard = card({
    title: '全部请求头',
    note: '按 Node 收到的原始顺序展示，保留原始大小写；同名头（如多个 Cookie、多个 X-Forwarded-For）会各自成行。',
    actions: `<div class="btn-row"><span class="pill pill-ok">HTTP/${esc(httpVersion(c) || '1.1')}</span></div>`,
    body: `<div class="toolbar">
      <input class="input" id="header-search" type="search" placeholder="搜索头名或值…" autocomplete="off">
      ${groupButtons}
      <button class="btn" type="button" id="btn-copy-json">复制 JSON</button>
    </div>${table}`,
  });

  const jsonCard = card({
    title: 'JSON 视图',
    note: '服务端原样返回的结构，便于接入其它程序或做断言。',
    body: `<details class="json-details" open>
      <summary class="mono" style="cursor:pointer;color:var(--muted);font-size:12.5px;margin-bottom:10px">展开 / 收起</summary>
      ${codeBlock(prettyJson(payload), 'json')}
    </details>`,
  });

  const diffCard = card({
    title: '导航请求 vs fetch 请求',
    note: '同一个浏览器发起的两种请求，头集合并不相同 —— 这正是服务端“看到的”和页面里 JS “能知道”的差异来源。',
    body: `<div id="fetch-diff"><p class="empty">正在发起一次 fetch 请求做对比…</p></div>`,
  });

  const navJson = JSON.stringify(payload.headers).replace(/</g, '\\u003c');

  return layout({
    title: '请求头全量',
    subtitle: '把这次请求的每一个 HTTP 头都摊开：原始名称、原始值、分组、体积，以及它和浏览器内部 fetch 请求的差异。',
    active: '/headers',
    badge: `${pairs.length} headers`,
    body: `${stats}${listCard}${diffCard}${jsonCard}
<script type="application/json" id="nav-headers-data">${navJson}</script>`,
    scripts: ['/static/common.js', '/static/headers.js'],
  });
}
