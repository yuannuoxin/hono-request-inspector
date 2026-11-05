// 请求头页：搜索 / 分组过滤 / 复制 / 与 fetch 请求对比
(function () {
  const table = document.getElementById('headers-table');
  if (!table) return;

  const rows = [...table.querySelectorAll('tbody tr')];
  const search = document.getElementById('header-search');
  const emptyTip = document.getElementById('headers-empty');
  const filterBtns = [...document.querySelectorAll('.filter-btn')];

  const FILTERS = {
    all: () => true,
    ch: (name) => name.startsWith('sec-ch-'),
    fetch: (name) => name.startsWith('sec-fetch-'),
    accept: (name) => name.startsWith('accept'),
    cookie: (name) => name === 'cookie',
    proxy: (name) => /^(x-|forwarded$|via$|cf-)/.test(name),
  };

  let activeFilter = 'all';
  let keyword = '';

  function apply() {
    const test = FILTERS[activeFilter] || FILTERS.all;
    let visible = 0;
    for (const row of rows) {
      const name = row.dataset.name;
      const text = row.textContent.toLowerCase();
      const matchGroup = test(name);
      const matchKeyword = !keyword || name.includes(keyword) || text.includes(keyword);
      const show = matchGroup && matchKeyword;
      row.style.display = show ? '' : 'none';
      if (show) visible += 1;
    }
    if (emptyTip) emptyTip.style.display = visible ? 'none' : '';
  }

  if (search) {
    search.addEventListener('input', () => {
      keyword = search.value.trim().toLowerCase();
      apply();
    });
  }

  for (const btn of filterBtns) {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.filter;
      for (const b of filterBtns) b.classList.toggle('is-on', b === btn);
      apply();
    });
  }

  // 复制完整 JSON
  const copyBtn = document.getElementById('btn-copy-json');
  const dataScript = document.getElementById('nav-headers-data');
  if (copyBtn && dataScript) {
    copyBtn.addEventListener('click', async () => {
      const ok = await (window.__copyText ? window.__copyText(dataScript.textContent) : Promise.resolve(false));
      copyBtn.textContent = ok ? '已复制' : '复制失败';
      setTimeout(() => {
        copyBtn.textContent = '复制 JSON';
      }, 1400);
    });
  }

  // ---------------- 导航请求 vs fetch 请求 ----------------
  const diffBox = document.getElementById('fetch-diff');
  if (!diffBox || !dataScript) return;

  function esc(v) {
    return String(v === undefined || v === null ? '' : v).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[ch]));
  }

  fetch('/api/headers', { cache: 'no-store', credentials: 'same-origin' })
    .then((r) => r.json())
    .then((fetched) => {
      const nav = JSON.parse(dataScript.textContent);
      const navOnly = [];
      const fetchOnly = [];
      const changed = [];

      for (const [k, v] of Object.entries(nav)) {
        if (!(k in fetched.headers)) navOnly.push([k, v]);
        else if (fetched.headers[k] !== v) changed.push([k, v, fetched.headers[k]]);
      }
      for (const [k, v] of Object.entries(fetched.headers)) {
        if (!(k in nav)) fetchOnly.push([k, v]);
      }

      const renderList = (items, cols) => {
        if (!items.length) return '<p class="empty">无</p>';
        const head = cols.map((c) => `<th>${esc(c)}</th>`).join('');
        const body = items
          .map((row) => `<tr>${row.map((c) => `<td class="value-cell">${esc(c)}</td>`).join('')}</tr>`)
          .join('');
        return `<table class="data"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
      };

      diffBox.innerHTML = `
        <div class="toolbar">
          <span class="pill pill-ok">导航请求 ${Object.keys(nav).length} 个</span>
          <span class="pill">fetch 请求 ${Object.keys(fetched.headers).length} 个</span>
        </div>
        <h3 style="font-size:13px;color:var(--muted);margin:16px 0 8px">只在导航请求中出现</h3>
        ${renderList(navOnly, ['请求头', '值'])}
        <h3 style="font-size:13px;color:var(--muted);margin:16px 0 8px">只在 fetch 请求中出现</h3>
        ${renderList(fetchOnly, ['请求头', '值'])}
        <h3 style="font-size:13px;color:var(--muted);margin:16px 0 8px">两边都有但值不同</h3>
        ${renderList(changed, ['请求头', '导航请求', 'fetch 请求'])}
        <div class="note" style="margin-top:16px">
          差异主要来自 <span class="mono">Sec-Fetch-*</span>（导航是 <span class="mono">mode=navigate</span>，fetch 是 <span class="mono">mode=cors / dest=empty</span>）和 <span class="mono">Accept</span>。
          浏览器还会在 fetch 请求里附加 <span class="mono">Sec-Fetch-Site: same-origin</span> 与 <span class="mono">Referer</span>。
        </div>`;
    })
    .catch((err) => {
      diffBox.innerHTML = `<p class="empty">对比失败：${esc(err && err.message ? err.message : err)}</p>`;
    });
})();
