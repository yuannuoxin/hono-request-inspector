// FingerprintJS v5 页：本地计算 + 回传服务端比对
(function () {
  const idEl = document.getElementById('fp-visitor-id');
  if (!idEl) return;

  const scoreEl = document.getElementById('fp-score');
  const commentEl = document.getElementById('fp-comment');
  const fillEl = document.getElementById('fp-conf-fill');
  const statusEl = document.getElementById('fp-status');
  const tbody = document.querySelector('#fp-components tbody');
  const countEl = document.getElementById('fp-component-count');
  const serverBox = document.getElementById('fp-server');
  const noteEl = document.getElementById('fp-note');
  const copyBtn = document.getElementById('fp-copy');
  const reloadBtn = document.getElementById('fp-reload');

  const LS_KEY = 'hono-inspector:last-visitor';
  let lastResult = null;

  const esc = (v) =>
    String(v === undefined || v === null ? '' : v).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch]));

  function pill(text, tone) {
    return `<span class="pill pill-${tone}">${esc(text)}</span>`;
  }

  function formatValue(value) {
    if (value === undefined) return '<span style="color:var(--dim)">undefined</span>';
    if (value === null) return '<span style="color:var(--dim)">null</span>';
    if (typeof value === 'object') {
      const json = JSON.stringify(value);
      return `<span class="mono">${esc(json.length > 240 ? json.slice(0, 240) + ' …' : json)}</span>`;
    }
    const text = String(value);
    if (text === '') return '<span style="color:var(--dim)">空字符串</span>';
    return `<span class="mono">${esc(text.length > 240 ? text.slice(0, 240) + ' …' : text)}</span>`;
  }

  function renderComponents(components) {
    const entries = Object.entries(components || {});
    if (!entries.length) {
      tbody.innerHTML = '<tr><td colspan="3" class="empty">该版本没有返回组件明细。</td></tr>';
      countEl.textContent = '0 个组件';
      return;
    }
    countEl.textContent = `${entries.length} 个组件`;
    tbody.innerHTML = entries
      .map(([key, entry]) => {
        const value = entry && typeof entry === 'object' && 'value' in entry ? entry.value : entry;
        const duration = entry && typeof entry === 'object' && 'duration' in entry ? `${Math.round(entry.duration)} ms` : '—';
        const isEmpty =
          value === undefined || value === '' || value === null || (Array.isArray(value) && !value.length);
        return `<tr data-empty="${isEmpty ? '1' : '0'}">
          <td class="key-cell">${esc(key)}</td>
          <td>${formatValue(value)}</td>
          <td class="mono" style="color:var(--dim)">${esc(duration)}</td>
        </tr>`;
      })
      .join('');
  }

  function showNote(html) {
    noteEl.style.display = '';
    noteEl.innerHTML = html;
  }

  async function run() {
    statusEl.textContent = '计算中…';
    statusEl.className = 'pill pill-warn';
    idEl.textContent = '计算中…';
    if (!window.FingerprintJS) {
      idEl.textContent = '加载失败';
      statusEl.textContent = 'fp.min.js 未加载';
      statusEl.className = 'pill pill-bad';
      return;
    }

    let result;
    try {
      const fp = await window.FingerprintJS.load();
      try {
        result = await fp.get({ extended: true });
      } catch (_) {
        result = await fp.get();
      }
    } catch (err) {
      idEl.textContent = '计算失败';
      statusEl.textContent = 'FingerprintJS 异常';
      statusEl.className = 'pill pill-bad';
      showNote(`<span style="color:var(--danger)">${esc(err && err.message ? err.message : err)}</span>`);
      return;
    }

    lastResult = result;
    idEl.textContent = result.visitorId;
    statusEl.textContent = '已完成';
    statusEl.className = 'pill pill-ok';

    const confidence = result.confidence || {};
    const score = typeof confidence.score === 'number' ? confidence.score : null;
    if (score === null) {
      scoreEl.textContent = '—';
    } else {
      scoreEl.textContent = `${(score * 100).toFixed(1)}%`;
      fillEl.style.width = `${Math.min(100, Math.max(0, score * 100)).toFixed(1)}%`;
    }
    // 开源版 v5 会在 comment 里塞 Pro 版推广链接，这里过滤掉，换成中性的解释
    const rawComment = String(confidence.comment || '');
    const isPromo = /fingerprint\.com|upgrade to Pro|utm_/i.test(rawComment);
    commentEl.textContent = isPromo
      ? '开源版不提供置信度解读（Pro 版才有）。分数越高，说明这套指纹在样本里越独特。'
      : rawComment || '无置信度说明';

    renderComponents(result.components);

    // 本地历史对比：同一浏览器多次打开是否稳定
    let previous = null;
    try {
      previous = JSON.parse(localStorage.getItem(LS_KEY) || 'null');
    } catch (_) {}
    if (previous && previous.visitorId && previous.visitorId !== result.visitorId) {
      showNote(`上次访问的 visitorId 是 <span class="mono">${esc(previous.visitorId)}</span>，与本次不同。
        常见原因：清了缓存、换了无痕窗口、浏览器升级、字体或硬件发生变化。`);
    } else if (previous && previous.visitorId) {
      showNote(`与上一次访问（${esc(new Date(previous.at).toLocaleString('zh-CN'))}）一致，本地判定为同一访客。`);
    }
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ visitorId: result.visitorId, at: Date.now() }));
    } catch (_) {}

    // 回传服务端
    try {
      const res = await fetch('/api/fingerprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          visitorId: result.visitorId,
          confidence: score,
          components: result.components || {},
        }),
      });
      const data = await res.json();
      renderServer(data);
    } catch (err) {
      serverBox.innerHTML = `<p class="empty">回传失败：${esc(err && err.message ? err.message : err)}</p>`;
    }
  }

  function renderServer(data) {
    if (!data || !data.ok) {
      serverBox.innerHTML = `<p class="empty">服务端拒绝：${esc((data && data.error) || '未知错误')}</p>`;
      return;
    }
    const time = (ts) => new Date(ts).toLocaleString('zh-CN');
    const changedRows = (data.changed || [])
      .map(
        (c) => `<tr>
          <td class="key-cell">${esc(c.key)}</td>
          <td>${formatValue(c.from)}</td>
          <td>${formatValue(c.to)}</td>
        </tr>`,
      )
      .join('');

    serverBox.innerHTML = `
      <div class="stats" style="margin-bottom:16px">
        <div class="stat"><div class="stat-label">该 ID 访问次数</div><div class="stat-value">${esc(data.visits)}</div></div>
        <div class="stat"><div class="stat-label">首次见到</div><div class="stat-value mono" style="font-size:13px">${esc(time(data.firstSeen))}</div></div>
        <div class="stat"><div class="stat-label">组件数量</div><div class="stat-value">${esc(data.componentCount)}</div></div>
        <div class="stat"><div class="stat-label">同 UA 的不同 ID</div><div class="stat-value">${esc(data.sameUaVisitorCount)}<span style="color:var(--dim);font-size:12px"> / 共 ${esc(data.totalVisitors)} 个</span></div></div>
      </div>
      ${
        data.visits === 1
          ? '<p class="empty">这是服务端第一次见到这个 visitorId，暂无历史可对比。刷新页面再看一次。</p>'
          : data.stable
            ? `<p>${pill('组件完全一致', 'ok')} 与上一次记录相比，所有组件取值都没有变化。</p>`
            : `<p>${pill(`有 ${data.changed.length} 个组件发生变化`, 'warn')} 下表是变化明细。</p>
              <table class="data" style="margin-top:12px">
                <thead><tr><th style="width:200px">组件</th><th>上一次</th><th>这一次</th></tr></thead>
                <tbody>${changedRows}</tbody>
              </table>`
      }`;
  }

  copyBtn.addEventListener('click', async () => {
    if (!lastResult) return;
    const ok = await window.__copyText(lastResult.visitorId);
    copyBtn.textContent = ok ? '已复制' : '复制失败';
    setTimeout(() => {
      copyBtn.textContent = '复制';
    }, 1400);
  });

  reloadBtn.addEventListener('click', run);

  let showEmpty = true;
  const toggleBtn = document.getElementById('fp-toggle-empty');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      showEmpty = !showEmpty;
      toggleBtn.textContent = showEmpty ? '隐藏空值组件' : '显示空值组件';
      for (const row of tbody.querySelectorAll('tr[data-empty="1"]')) {
        row.style.display = showEmpty ? '' : 'none';
      }
    });
  }

  run();
})();
