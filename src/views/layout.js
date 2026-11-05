// 页面骨架：所有页面共用同一套导航与主题
import { esc } from '../lib/util.js';

const NAV = [
  { href: '/', label: '总览' },
  { href: '/ua', label: 'UA 解析' },
  { href: '/client-hints', label: 'Client Hints' },
  { href: '/headers', label: '请求头' },
  { href: '/fingerprint', label: 'Fingerprint v5' },
];

export function layout({ title, subtitle, active, badge, body, scripts = [] }) {
  const nav = NAV.map(
    (item) =>
      `<a class="nav-item${item.href === active ? ' is-active' : ''}" href="${item.href}">${esc(item.label)}</a>`,
  ).join('');

  const scriptTags = scripts
    .map((s) => `<script src="${esc(s)}" defer></script>`)
    .join('\n');

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · Hono Request Inspector</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22%3E%3Ccircle cx=%2216%22 cy=%2216%22 r=%2212%22 fill=%22none%22 stroke=%22%2334d3c0%22 stroke-width=%223%22/%3E%3Ccircle cx=%2216%22 cy=%2216%22 r=%224%22 fill=%22%2334d3c0%22/%3E%3C/svg%3E">
<link rel="stylesheet" href="/static/styles.css">
</head>
<body>
<div class="glow" aria-hidden="true"></div>
<header class="topbar">
  <div class="topbar-inner">
    <a class="brand" href="/"><span class="brand-mark">◍</span> Request Inspector</a>
    <nav class="nav">${nav}</nav>
  </div>
</header>
<main class="wrap">
  <div class="page-head">
    <div>
      <h1>${esc(title)}</h1>
      ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ''}
    </div>
    ${badge ? `<div class="badge">${badge}</div>` : ''}
  </div>
  ${body}
</main>
<footer class="footer">
  <span>Hono + Node.js · 所有数据来自本次真实请求</span>
  <span>本地示例项目</span>
</footer>
${scriptTags}
</body>
</html>`;
}

/** 通用卡片 */
export function card({ title, note, body, actions = '' }) {
  return `<section class="card">
  <div class="card-head">
    <div>
      <h2>${esc(title)}</h2>
      ${note ? `<p class="card-note">${note}</p>` : ''}
    </div>
    ${actions}
  </div>
  ${body}
</section>`;
}

/** 键值表格 */
export function kvTable(rows) {
  const trs = rows
    .map(
      ([k, v, extra]) => `<tr>
      <th scope="row">${esc(k)}</th>
      <td>${extra === undefined ? `<span class="mono">${esc(v)}</span>` : v}</td>
    </tr>`,
    )
    .join('');
  return `<table class="kv"><tbody>${trs}</tbody></table>`;
}

/** 可复制的代码块 */
export function codeBlock(text, lang = 'text') {
  return `<div class="code-wrap">
  <button class="copy" type="button" data-copy>复制</button>
  <pre class="code" data-lang="${esc(lang)}"><code>${esc(text)}</code></pre>
</div>`;
}

/** 状态胶囊 */
export function pill(text, tone = 'neutral') {
  return `<span class="pill pill-${esc(tone)}">${esc(text)}</span>`;
}
