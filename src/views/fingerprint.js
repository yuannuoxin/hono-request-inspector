// FingerprintJS v5 页
import { card, layout, pill } from './layout.js';

export function fingerprintView(_c) {
  const hero = `<section class="card">
  <div class="fp-hero">
    <div>
      <div class="fp-id-label">visitorId</div>
      <div class="fp-id" id="fp-visitor-id">加载中…</div>
      <div style="display:flex;gap:10px;align-items:center;margin-top:10px;flex-wrap:wrap">
        <button class="btn" type="button" id="fp-copy">复制</button>
        <button class="btn" type="button" id="fp-reload">重新计算</button>
        <span id="fp-status" class="pill pill-warn">初始化…</span>
      </div>
    </div>
    <div>
      <div class="fp-id-label">置信度 confidence</div>
      <div style="font-size:22px;font-weight:600" id="fp-score">—</div>
      <div class="conf-bar"><div class="conf-fill" id="fp-conf-fill"></div></div>
      <div style="color:var(--dim);font-size:12px;margin-top:8px" id="fp-comment">—</div>
    </div>
  </div>
  <div class="note" id="fp-note" style="display:none"></div>
</section>`;

  const componentsCard = card({
    title: '指纹组件明细',
    note: 'FingerprintJS v5 完全在浏览器本地计算，每个组件的原始取值都列出来，方便看清它到底读了哪些浏览器 API。',
    actions: '<span class="pill pill-warn">客户端计算</span>',
    body: `<div class="toolbar">
      <span class="pill" id="fp-component-count">—</span>
      <button class="btn" type="button" id="fp-toggle-empty">显示空值组件</button>
    </div>
    <table class="data" id="fp-components">
      <thead><tr><th style="width:220px">组件</th><th>取值</th><th style="width:90px">耗时</th></tr></thead>
      <tbody><tr><td colspan="3" class="empty">等待浏览器计算…</td></tr></tbody>
    </table>`,
  });

  const serverCard = card({
    title: '服务端记录与稳定性比对',
    note: '把结果回传给 Hono，服务端按 visitorId 归档并对比上一次的组件取值 —— 这才是真正要关心的：同一个设备多次访问，ID 稳不稳。',
    body: `<div id="fp-server">
      <p class="empty">等待回传…</p>
    </div>`,
  });

  const howCard = card({
    title: '它是怎么算出来的',
    note: 'v5 的算法要点，读源码前先有个印象。',
    body: `<div class="note"><ul>
      <li>v5 不再把所有信号塞进一个大字符串再做一次 Murmur 哈希，而是按“组件 → 稳定信号 → 模糊匹配”三级组装。</li>
      <li>每个组件（字体、时区、硬件并发数、Canvas、Audio、WebGL 等）各自给出一个值，再由 <span class="mono">stable 信号</span> 与 <span class="mono">entropy 分数</span> 决定权重。</li>
      <li>最终 visitorId 是 32 位十六进制字符串；<span class="mono">confidence.score</span> 表示这次结果落在唯一区间的可信程度。</li>
      <li>同一台设备换浏览器、装新字体、改时区、升级系统都会让部分组件漂移，所以 ID 天生不是永久标识，通常配合 Cookie / 登录态做合并。</li>
    </ul></div>`,
  });

  return layout({
    title: 'FingerprintJS v5',
    subtitle: '在浏览器里跑 FingerprintJS v5 开源版，输出 visitorId、置信度与全部组件取值，并回传服务端验证稳定性。',
    active: '/fingerprint',
    badge: 'browser-side',
    body: `${hero}${componentsCard}${serverCard}${howCard}
<div class="card"><h2>说明</h2><p class="card-note" style="margin-top:8px">
本页使用的 fp.min.js 直接来自 npm 包 <span class="mono">@fingerprintjs/fingerprintjs</span>（开源版，无需 API Key），由本服务本地托管，不依赖外网 CDN。
</p></div>`,
    scripts: ['/static/vendor/fp.min.js', '/static/common.js', '/static/fingerprint.js'],
  });
}
