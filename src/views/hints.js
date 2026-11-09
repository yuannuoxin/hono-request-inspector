// Client Hints 解析页
import { card, codeBlock, layout, pill } from './layout.js';
import { esc, getHeader } from '../lib/util.js';
import { REQUEST_HINTS, readHints } from '../lib/hints.js';

function hintTable(items) {
  if (!items.length) return '<p class="empty">没有条目。</p>';
  return `<table class="data t-hints">
  <thead><tr><th>请求头</th><th>状态</th><th>原始值</th><th>解析结果</th></tr></thead>
  <tbody>
  ${items
    .map((h) => {
      const present = h.status === 'present';
      return `<tr>
      <td><div class="key-cell">${esc(h.label)}</div><div style="color:var(--dim);font-size:12px">${esc(h.name)}</div></td>
      <td>${present ? pill('已收到', 'ok') : pill('未发送', 'miss')}</td>
      <td class="value-cell">${present ? esc(h.raw) : '—'}</td>
      <td>${present ? esc(h.readable) : '<span class="mono" style="color:var(--dim)">—</span>'}</td>
    </tr>`;
    })
    .join('')}
  </tbody></table>`;
}

export function hintsView(c) {
  const hints = readHints(c);
  const low = hints.filter((h) => h.group === 'low');
  const high = hints.filter((h) => h.group === 'high');
  const other = hints.filter((h) => h.group === 'other');

  const lowPresent = low.filter((h) => h.status === 'present').length;
  const highPresent = high.filter((h) => h.status === 'present').length;

  const protocol = new URL(c.req.url).protocol;
  const host = new URL(c.req.url).hostname;
  const secure = protocol === 'https:' || host === 'localhost' || host === '127.0.0.1' || host === '::1';
  const highEntropyGranted = REQUEST_HINTS.some(
    (k) => getHeader(c, 'sec-ch-ua-arch') !== undefined || getHeader(c, 'sec-ch-ua-platform-version') !== undefined,
  );

  const stats = `<div class="stats">
  <div class="stat"><div class="stat-label">低熵提示</div><div class="stat-value">${lowPresent} / ${low.length}</div></div>
  <div class="stat"><div class="stat-label">高熵提示</div><div class="stat-value">${highPresent} / ${high.length}</div></div>
  <div class="stat"><div class="stat-label">响应中已请求</div><div class="stat-value">${REQUEST_HINTS.length} 个</div></div>
  <div class="stat"><div class="stat-label">安全上下文</div><div class="stat-value">${secure ? pill('是', 'ok') : pill('否 · 高熵不会发送', 'bad')}</div></div>
</div>`;

  const explainCard = card({
    title: '为什么有些头是空的',
    note: 'Client Hints 是惰性发送的：浏览器默认只发低熵三项，其余必须由服务端主动“下单”。',
    body: `<div class="note">
    <ul>
      <li>本服务在每个响应里都设置了 <span class="mono">Accept-CH</span>，但浏览器只会在<b>下一次请求</b>开始附加这些高熵头。</li>
      <li>同时还设置了 <span class="mono">Critical-CH</span>，浏览器发现“关键提示缺失”时会立刻重发一次请求补齐 —— 所以你刷新后应该已经能看到一部分高熵值。</li>
      <li>高熵提示只在<b>安全上下文</b>（HTTPS，或 localhost / 127.0.0.1）下发送。用局域网 IP 走 http 访问时，这一栏永远是空的。</li>
      <li>不同浏览器支持度不同：Chrome / Edge 支持最全，Firefox 基本不支持，Safari 只支持少量。</li>
    </ul>
    </div>
    <div class="toolbar" style="margin-top:14px">
      <a class="btn" href="/client-hints">重新加载本页（触发第 2 次请求）</a>
      <button class="btn" type="button" id="btn-reload-hints">用 JS 重新获取高熵值</button>
    </div>`,
  });

  const lowCard = card({
    title: '低熵提示 · Low-entropy Hints',
    note: '每次请求自动携带，无需任何协商，浏览器普遍支持。',
    body: hintTable(low),
  });

  const highCard = card({
    title: '高熵提示 · High-entropy Hints',
    note: '必须通过 Accept-CH 显式请求，属于可识别度更高的信息 —— 组合起来足以大致定位一台设备。',
    body: hintTable(high),
  });

  const otherCard = card({
    title: '网络与状态类',
    note: '严格说不是 UA Client Hints，但同属“浏览器主动上报”的粗粒度环境信息。',
    body: hintTable(other),
  });

  const responseCard = card({
    title: '本服务正在请求的字段',
    note: '下面是当前响应里实际发出的协商头，可以直接抄到你自己的项目里。',
    body: codeBlock(
      `Accept-CH: ${REQUEST_HINTS.join(', ')}
Critical-CH: ${REQUEST_HINTS.join(', ')}
Vary: ${REQUEST_HINTS.join(', ')}`,
      'http-header',
    ),
  });

  const jsCard = card({
    title: '浏览器端 API 对照 · navigator.userAgentData',
    note: '同一份信息在 JS 侧的获取方式。与上面的请求头对照，可以验证服务端看到的是不是同一套值。',
    body: `<div id="js-hints"><p class="empty">正在读取 navigator.userAgentData…</p></div>`,
    actions: '<span class="pill pill-warn">需要浏览器执行</span>',
  });

  return layout({
    title: 'Client Hints 解析',
    subtitle: '按规范逐项解析 Sec-CH-* 请求头，区分低熵与高熵，并给出每一项背后的含义。',
    active: '/client-hints',
    badge: highEntropyGranted ? '高熵已授权' : `高熵 ${highPresent}/${high.length}`,
    body: `${stats}${explainCard}${lowCard}${highCard}${otherCard}${responseCard}${jsCard}`,
    scripts: ['/static/common.js', '/static/hints.js'],
  });
}
