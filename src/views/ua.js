// UA 解析页
import { card, codeBlock, kvTable, layout, pill } from './layout.js';
import { getHeader } from '../lib/util.js';
import { readUserAgent, uaReductionNotes } from '../lib/ua.js';
import { parseBrandList } from '../lib/hints.js';

function windowsLabelFromPlatformVersion(version) {
  const major = Number(String(version || '').split('.')[0]);
  if (!Number.isFinite(major) || !major) return null;
  if (major >= 19) return 'Windows 11 24H2 / 25H2（推测）';
  if (major >= 15) return 'Windows 11 23H2（推测）';
  if (major >= 14) return 'Windows 11 22H2（推测）';
  if (major >= 13) return 'Windows 11 21H2（推测）';
  if (major >= 10) return 'Windows 10 2004 ~ 22H2（推测）';
  if (major >= 8) return 'Windows 10 1903 / 1909（推测）';
  if (major >= 7) return 'Windows 10 1809（推测）';
  return 'Windows 10 早期版本（推测）';
}

function correctionCard(c, ua) {
  const unquote = (v) => (v ? v.replace(/^"|"$/g, '') : '');
  const platform = unquote(getHeader(c, 'sec-ch-ua-platform'));
  const platformVersion = unquote(getHeader(c, 'sec-ch-ua-platform-version'));
  const arch = unquote(getHeader(c, 'sec-ch-ua-arch'));
  const bitness = unquote(getHeader(c, 'sec-ch-ua-bitness'));
  const fullList = getHeader(c, 'sec-ch-ua-full-version-list');
  const fullVersion = parseBrandList(fullList).find((b) => !b.greasy)?.version || '';
  const model = unquote(getHeader(c, 'sec-ch-ua-model'));

  if (!platform && !platformVersion) {
    return card({
      title: 'Client Hints 校正',
      note: '本次请求没带任何高熵提示，无法校正 —— UA 串里的系统/版本信息只能照单全收。',
      body: '<p class="empty">换 Chromium 系浏览器，或在 HTTPS / localhost 下访问并刷新一次即可补齐。</p>',
    });
  }

  const osGuess = platform === 'Windows' ? windowsLabelFromPlatformVersion(platformVersion) : null;

  return card({
    title: 'Client Hints 校正',
    note: '同一份信息的“可信版本”：UA 串里被冻结的字段，在这里能拿到真实值。',
    body: kvTable([
      ['UA 声称的系统', `${ua.summary.os}（UA 串里被冻结的值，不一定等于真实版本）`],
      ['CH 平台', platform || '—'],
      ['CH 平台版本', platformVersion || '—'],
      ['推断的真实系统', osGuess || '（非 Windows，直接读平台版本即可）'],
      ['CH 架构 / 位宽', [arch, bitness && `${bitness} 位`].filter(Boolean).join(' · ') || '—'],
      ['CH 完整浏览器版本', fullVersion || '—'],
      ['CH 设备型号', model || '空字符串（桌面端正常）'],
    ]),
  });
}

export function uaView(c) {
  const ua = readUserAgent(c);
  const notes = uaReductionNotes(ua.raw);

  const stats = `<div class="stats">
  <div class="stat"><div class="stat-label">浏览器</div><div class="stat-value">${ua.summary.browser}</div></div>
  <div class="stat"><div class="stat-label">渲染引擎</div><div class="stat-value">${ua.summary.engine}</div></div>
  <div class="stat"><div class="stat-label">操作系统</div><div class="stat-value">${ua.summary.os}</div></div>
  <div class="stat"><div class="stat-label">设备</div><div class="stat-value">${ua.summary.device}</div></div>
</div>`;

  const rawCard = card({
    title: '原始 User-Agent',
    note: `长度 ${ua.raw.length} 字符 · 共 ${ua.raw.split(' ').length} 个空格分隔的片段`,
    body: ua.raw
      ? codeBlock(ua.raw, 'http-header')
      : '<p class="empty">本次请求没有携带 User-Agent（可能是 curl -H 或某些代理剥离了它）。</p>',
  });

  const browser = ua.browser || {};
  const os = ua.os || {};
  const engine = ua.engine || {};
  const device = ua.device || {};
  const cpu = ua.cpu || {};

  const detailCard = card({
    title: '结构化解析',
    note: 'ua-parser-js v2 的字段拆解；空值表示该字段在 UA 串里没有对应信息。',
    body: kvTable([
      ['浏览器', `${browser.name || '未知'} ${browser.version || ''}`.trim()],
      ['主版本号', browser.major || '—'],
      ['浏览器类型', browser.type || '—'],
      ['引擎', `${engine.name || '未知'} ${engine.version || ''}`.trim()],
      ['操作系统', `${os.name || '未知'} ${os.version || ''}`.trim()],
      ['设备厂商', device.vendor || '—'],
      ['设备型号', device.model || '—'],
      ['设备类型', device.type || '—'],
      ['CPU 架构', cpu.architecture || '—'],
      ['识别到的客户端', ua.bots.length ? ua.bots.map((b) => pill(b, 'warn')).join(' ') : '常规浏览器'],
    ]),
  });

  const notesCard = card({
    title: 'UA Reduction：为什么 UA 已经不可靠',
    note: 'Chrome 从 101 起冻结了 UA 里的版本号与系统信息，这是设计如此，不是解析库的问题。',
    body: `<div class="note"><ul>${notes.map((n) => `<li>${n}</li>`).join('')}</ul></div>`,
  });

  const fullResult = card({
    title: '完整解析结果（JSON）',
    note: '方便直接拷到自己的项目里做参考结构。',
    body: codeBlock(JSON.stringify(ua.result, null, 2), 'json'),
  });

  const chUa = getHeader(c, 'sec-ch-ua');
  const brands = parseBrandList(chUa);
  const brandsCard = brands.length
    ? card({
        title: 'Client Hints 交叉验证',
        note: 'Sec-CH-UA 的品牌列表 —— 与 UA 串对照着看，能立刻发现 UA 串里缺失的真实版本。',
        body: `<table class="data t-brands"><thead><tr><th>品牌</th><th>版本</th><th>类型</th></tr></thead><tbody>
      ${brands
        .map(
          (b) => `<tr><td class="value-cell">${b.brand}</td><td class="value-cell">${b.version}</td><td>${
            b.greasy ? pill('greasy 占位', 'warn') : pill('真实品牌', 'ok')
          }</td></tr>`,
        )
        .join('')}
    </tbody></table>`,
      })
    : card({
        title: 'Client Hints 交叉验证',
        note: '本次请求没有 Sec-CH-UA，无法做交叉验证。',
        body: '<p class="empty">只有 Chromium 系浏览器在 HTTPS（或 localhost）下才会发送 Client Hints。</p>',
      });

  return layout({
    title: 'User-Agent 解析',
    subtitle: '把客户端自报的 UA 串拆成结构化字段。注意：服务端永远不应该只信任 UA —— 它可以被任意伪造，而且在现代 Chrome 里已经被主动缩减。',
    active: '/ua',
    badge: ua.summary.browser,
    body: `${stats}${rawCard}${detailCard}${correctionCard(c, ua)}${notesCard}${brandsCard}${fullResult}`,
    scripts: ['/static/common.js'],
  });
}
