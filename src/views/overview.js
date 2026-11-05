// 总览页
import { card, layout } from './layout.js';
import { headerPairs, remoteAddress, httpVersion, getHeader, runtimeLabel } from '../lib/util.js';
import { readUserAgent } from '../lib/ua.js';
import { readHints } from '../lib/hints.js';

export function overviewView(c) {
  const ua = readUserAgent(c);
  const pairs = headerPairs(c);
  const hints = readHints(c);
  const present = hints.filter((h) => h.status === 'present').length;

  const stats = `<div class="stats">
  <div class="stat"><div class="stat-label">浏览器</div><div class="stat-value">${ua.summary.browser}</div></div>
  <div class="stat"><div class="stat-label">操作系统</div><div class="stat-value">${ua.summary.os}</div></div>
  <div class="stat"><div class="stat-label">设备</div><div class="stat-value">${ua.summary.device}</div></div>
  <div class="stat"><div class="stat-label">远端地址</div><div class="stat-value mono">${remoteAddress(c)}</div></div>
</div>`;

  const cards = `<div class="grid">
  <a class="link-card" href="/ua">
    <div class="lc-title">UA 解析</div>
    <div class="lc-desc">把 User-Agent 字符串拆成浏览器、引擎、系统、设备、CPU 五组结构化字段，并检查是否被 UA Reduction 冻结。</div>
    <div class="lc-path"><span>/ua</span><span class="pill pill-ok">ua-parser-js</span></div>
  </a>
  <a class="link-card" href="/client-hints">
    <div class="lc-title">Client Hints 解析</div>
    <div class="lc-desc">逐个解析 Sec-CH-* 头，区分低熵与高熵提示，并与浏览器端 navigator.userAgentData 的高熵结果做对照。</div>
    <div class="lc-path"><span>/client-hints</span><span class="pill pill-ok">${present}/${hints.length}</span></div>
  </a>
  <a class="link-card" href="/headers">
    <div class="lc-title">请求头全量</div>
    <div class="lc-desc">展示本次请求收到的所有原始头（保留大小写与重复顺序），支持搜索、分组过滤、JSON 导出与 fetch 请求对比。</div>
    <div class="lc-path"><span>/headers</span><span class="pill pill-ok">${pairs.length} 个</span></div>
  </a>
  <a class="link-card" href="/fingerprint">
    <div class="lc-title">Fingerprint v5</div>
    <div class="lc-desc">在浏览器里跑 FingerprintJS v5 开源版，输出 visitorId、置信度与每个信号组件的取值，并回传服务端做稳定性比对。</div>
    <div class="lc-path"><span>/fingerprint</span><span class="pill pill-warn">浏览器端</span></div>
  </a>
</div>`;

  const body = `${stats}${cards}${card({
    title: '本次请求',
    note: '这一屏的内容全部来自你当前这次真实请求，没有 mock 数据。',
    body: `<table class="kv"><tbody>
  <tr><th scope="row">请求行</th><td class="mono">${c.req.method} ${c.req.path} · HTTP/${httpVersion(c) || '1.1'}</td></tr>
  <tr><th scope="row">运行时</th><td>${runtimeLabel(c)}<span class="mono" style="color:var(--dim);margin-left:8px">${remoteAddress(c)}</span></td></tr>
  <tr><th scope="row">User-Agent</th><td><span class="mono">${ua.raw ? ua.raw.slice(0, 160) + (ua.raw.length > 160 ? '…' : '') : '（未发送）'}</span></td></tr>
  <tr><th scope="row">已收到提示</th><td>${present} / ${hints.length} 个已知 Client Hints</td></tr>
  <tr><th scope="row">Accept</th><td class="mono">${getHeader(c, 'accept') || '（未发送）'}</td></tr>
  <tr><th scope="row">Accept-Language</th><td class="mono">${getHeader(c, 'accept-language') || '（未发送）'}</td></tr>
  <tr><th scope="row">头总字节</th><td>约 ${pairs.reduce((n, [k, v]) => n + k.length + String(v).length + 4, 0)} 字节</td></tr>
</tbody></table>`,
  })}`;

  return layout({
    title: '请求特征总览',
    subtitle: '一个用 Hono 写的、把 HTTP 请求里能看到的身份信号逐层拆开的小工具：UA、Client Hints、原始请求头、浏览器指纹。',
    active: '/',
    badge: `${runtimeLabel(c)} · HTTP/${httpVersion(c) || '1.1'}`,
    body,
  });
}
