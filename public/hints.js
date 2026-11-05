// Client Hints 页：浏览器端 navigator.userAgentData 对照
(function () {
  const box = document.getElementById('js-hints');
  if (!box) return;

  const esc = (v) =>
    String(v === undefined || v === null ? '' : v).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch]));

  const KEYS = [
    'architecture',
    'bitness',
    'brands',
    'formFactors',
    'fullVersionList',
    'model',
    'platform',
    'platformVersion',
    'uaFullVersion',
    'wow64',
  ];

  function brandTable(brands) {
    if (!Array.isArray(brands) || !brands.length) return '';
    return `<table class="data" style="margin-bottom:16px">
      <thead><tr><th>品牌</th><th>版本</th></tr></thead>
      <tbody>${brands
        .map((b) => `<tr><td class="value-cell">${esc(b.brand)}</td><td class="value-cell">${esc(b.version)}</td></tr>`)
        .join('')}</tbody>
    </table>`;
  }

  function fmt(value) {
    if (value === undefined) return '<span style="color:var(--dim)">undefined（浏览器未提供）</span>';
    if (typeof value === 'string' && value === '') return '<span style="color:var(--dim)">空字符串</span>';
    if (typeof value === 'object') return `<span class="mono">${esc(JSON.stringify(value))}</span>`;
    return `<span class="mono">${esc(value)}</span>`;
  }

  async function render() {
    if (!navigator.userAgentData) {
      box.innerHTML =
        '<p class="empty">当前浏览器没有提供 <span class="mono">navigator.userAgentData</span>（Firefox / Safari 常见），只能靠请求头判断。</p>';
      return;
    }

    const uaData = navigator.userAgentData;
    let high = {};
    try {
      high = await uaData.getHighEntropyValues(KEYS);
    } catch (err) {
      box.innerHTML = `<p class="empty">getHighEntropyValues 调用失败：${esc(err && err.message ? err.message : err)}</p>`;
      return;
    }

    const rows = KEYS.map((k) => `<tr><td class="key-cell">${esc(k)}</td><td>${fmt(high[k])}</td></tr>`).join('');

    box.innerHTML = `
      <div class="toolbar">
        <span class="pill pill-ok">navigator.userAgentData 可用</span>
        <span class="pill">低熵：brands / mobile / platform</span>
      </div>
      <div style="color:var(--dim);font-size:12.5px;margin-bottom:8px">
        低熵字段（无需授权，JS 直接可读）：brands、mobile=${esc(uaData.mobile)}、platform=${esc(uaData.platform)}
      </div>
      ${brandTable(high.brands || uaData.brands)}
      <table class="data"><thead><tr><th style="width:200px">字段</th><th>取值</th></tr></thead><tbody>${rows}</tbody></table>
      <div style="margin-top:14px">
        <div class="code-wrap">
          <button class="copy" type="button" data-copy>复制</button>
          <pre class="code"><code>${esc(JSON.stringify(high, null, 2))}</code></pre>
        </div>
      </div>`;
  }

  const reloadBtn = document.getElementById('btn-reload-hints');
  if (reloadBtn) reloadBtn.addEventListener('click', render);

  render();
})();
