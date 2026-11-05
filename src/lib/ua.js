// User-Agent 解析（ua-parser-js v2）
import { UAParser } from 'ua-parser-js';
import { getHeader } from './util.js';

/** 直接命中已知爬虫 / 工具的关键字，用于给出额外提示 */
const BOT_HINTS = [
  { re: /Googlebot/i, label: 'Google 爬虫' },
  { re: /bingbot/i, label: 'Bing 爬虫' },
  { re: /Baiduspider/i, label: '百度爬虫' },
  { re: /curl\//i, label: 'curl 命令行' },
  { re: /Wget/i, label: 'wget 命令行' },
  { re: /python-requests|python-urllib|aiohttp|httpx/i, label: 'Python HTTP 客户端' },
  { re: /PostmanRuntime/i, label: 'Postman' },
  { re: /HeadlessChrome/i, label: '无头 Chrome（自动化）' },
  { re: /Electron/i, label: 'Electron 应用' },
  { re: /Dalvik|okhttp/i, label: 'Android 原生 / OkHttp' },
];

export function parseUserAgent(ua) {
  const raw = ua || '';
  let result = { ua: raw, browser: {}, engine: {}, os: {}, device: {}, cpu: {} };
  try {
    result = new UAParser(raw).getResult();
  } catch (_) {
    /* 保底：解析失败也要能展示原始串 */
  }
  const browser = result.browser || {};
  const os = result.os || {};
  const engine = result.engine || {};
  const device = result.device || {};
  const cpu = result.cpu || {};

  const bots = BOT_HINTS.filter((b) => b.re.test(raw)).map((b) => b.label);

  return {
    raw,
    browser,
    os,
    engine,
    device,
    cpu,
    result,
    bots,
    summary: {
      browser: [browser.name, browser.version].filter(Boolean).join(' ') || '未知',
      os: [os.name, os.version].filter(Boolean).join(' ') || '未知',
      engine: [engine.name, engine.version].filter(Boolean).join(' ') || '未知',
      device: [device.vendor, device.model, device.type ? `(${device.type})` : '']
        .filter(Boolean)
        .join(' ')
        .trim() || '桌面（未识别型号）',
      cpu: cpu.architecture || '未知',
    },
  };
}

export function readUserAgent(c) {
  return parseUserAgent(getHeader(c, 'user-agent'));
}

/** 现代浏览器 UA 缩减（UA Reduction）的检查点 */
export function uaReductionNotes(raw) {
  const notes = [];
  if (/Windows NT 10\.0/.test(raw) && !/Windows NT 1[1-9]/.test(raw)) {
    notes.push('Windows 10/11 在 UA 里都被写成 "Windows NT 10.0" —— UA 无法区分 Win10 与 Win11，得看 Sec-CH-UA-Platform-Version。');
  }
  if (/(Chrome|Chromium)\/(\d+)/.test(raw)) {
    const major = /(?:Chrome|Chromium)\/(\d+)/.exec(raw)[1];
    if (!/Chrome\/\d+\.\d+\.\d+\.\d+/.test(raw)) {
      notes.push('Chrome 主版本号被冻结为 "Chrome/' + major + '.0.0.0"，精确版本只在 Sec-CH-UA-Full-Version-List 里。');
    }
  }
  if (/Macintosh; Intel Mac OS X 10_15_7/.test(raw)) {
    notes.push('macOS 的 UA 被冻结成 "Mac OS X 10_15_7"，真实版本（如 14.x / 15.x）只能从 Sec-CH-UA-Platform-Version 取得。');
  }
  if (/Android 10; K/.test(raw)) {
    notes.push('Android 的 UA 被缩减为 "Android 10; K"，真实机型与系统版本被抹掉，需要 Sec-CH-UA-Model / Platform-Version。');
  }
  if (!notes.length) {
    notes.push('该 UA 未命中常见的冻结规则，但仍建议以 Client Hints 作为主判据。');
  }
  return notes;
}
