// 通用交互：复制按钮
(function () {
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    }
  }

  function flash(btn, text) {
    const original = btn.textContent;
    btn.textContent = text;
    setTimeout(() => {
      btn.textContent = original;
    }, 1400);
  }

  document.addEventListener('click', async (event) => {
    const btn = event.target.closest('[data-copy]');
    if (!btn) return;
    const wrap = btn.closest('.code-wrap');
    const pre = wrap && wrap.querySelector('code');
    if (!pre) return;
    const ok = await copyText(pre.textContent);
    flash(btn, ok ? '已复制' : '复制失败');
  });

  window.__copyText = copyText;
})();
