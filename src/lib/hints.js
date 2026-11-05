// Client Hints 定义、读取与解析
import { getHeader } from './util.js';

/** 建议在响应头里通过 Accept-CH 请求的高熵提示（顺序即 Critical-CH 顺序） */
export const REQUEST_HINTS = [
  'Sec-CH-UA-Full-Version-List',
  'Sec-CH-UA-Full-Version',
  'Sec-CH-UA-Platform-Version',
  'Sec-CH-UA-Arch',
  'Sec-CH-UA-Bitness',
  'Sec-CH-UA-Model',
  'Sec-CH-UA-WoW64',
  'Sec-CH-UA-Form-Factors',
  'Device-Memory',
  'DPR',
  'Viewport-Width',
  'Viewport-Height',
  'RTT',
  'Downlink',
  'ECT',
  'Sec-CH-Prefers-Color-Scheme',
  'Sec-CH-Prefers-Reduced-Motion',
];

/** 前端 navigator.userAgentData.getHighEntropyValues() 可取的字段 */
export const HIGH_ENTROPY_KEYS = [
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

export const KNOWN_HINTS = [
  {
    key: 'sec-ch-ua',
    group: 'low',
    label: 'Sec-CH-UA',
    name: '品牌列表',
    desc: '浏览器品牌与主版本号的集合，Chrome 会把真实品牌藏在 “greasy” 假品牌里。',
    type: 'brands',
  },
  {
    key: 'sec-ch-ua-mobile',
    group: 'low',
    label: 'Sec-CH-UA-Mobile',
    name: '是否移动设备',
    desc: '?1 表示移动端，?0 表示桌面端。',
    type: 'boolean',
  },
  {
    key: 'sec-ch-ua-platform',
    group: 'low',
    label: 'Sec-CH-UA-Platform',
    name: '操作系统平台',
    desc: '如 "Windows"、"macOS"、"Android"、"Linux"。',
    type: 'quoted',
  },
  {
    key: 'sec-ch-ua-full-version-list',
    group: 'high',
    label: 'Sec-CH-UA-Full-Version-List',
    name: '完整版本品牌列表',
    desc: '每个品牌的三段式完整版本号。',
    type: 'brands',
  },
  {
    key: 'sec-ch-ua-full-version',
    group: 'high',
    label: 'Sec-CH-UA-Full-Version',
    name: '完整版本号',
    desc: '已废弃字段，Chrome 逐步用 Full-Version-List 替代。',
    type: 'quoted',
  },
  {
    key: 'sec-ch-ua-platform-version',
    group: 'high',
    label: 'Sec-CH-UA-Platform-Version',
    name: '平台版本',
    desc: '操作系统版本号，例如 Windows 19.0.0 对应 Win 11 23H2+。',
    type: 'quoted',
  },
  {
    key: 'sec-ch-ua-arch',
    group: 'high',
    label: 'Sec-CH-UA-Arch',
    name: 'CPU 架构',
    desc: '如 "x86"、"arm"。',
    type: 'quoted',
  },
  {
    key: 'sec-ch-ua-bitness',
    group: 'high',
    label: 'Sec-CH-UA-Bitness',
    name: '位宽',
    desc: '浏览器进程的位宽，如 "64"。',
    type: 'quoted',
  },
  {
    key: 'sec-ch-ua-model',
    group: 'high',
    label: 'Sec-CH-UA-Model',
    name: '设备型号',
    desc: '主要在 Android 上提供，如 "Pixel 7"；桌面端通常为空字符串。',
    type: 'quoted',
  },
  {
    key: 'sec-ch-ua-wow64',
    group: 'high',
    label: 'Sec-CH-UA-WoW64',
    name: 'WoW64',
    desc: '?1 表示 32 位浏览器进程运行在 64 位 Windows 上。',
    type: 'boolean',
  },
  {
    key: 'sec-ch-ua-form-factors',
    group: 'high',
    label: 'Sec-CH-UA-Form-Factors',
    name: '设备形态',
    desc: '如 "Desktop"、"Mobile"、"Tablet"、"XR"。',
    type: 'list',
  },
  {
    key: 'device-memory',
    group: 'high',
    label: 'Device-Memory',
    name: '设备内存 (GB)',
    desc: '取 2 的幂并做向下取整，属于粗粒度信息。',
    type: 'number',
  },
  {
    key: 'dpr',
    group: 'high',
    label: 'DPR',
    name: '设备像素比',
    desc: 'devicePixelRatio，窗口跨屏拖动时可能变化。',
    type: 'number',
  },
  {
    key: 'viewport-width',
    group: 'high',
    label: 'Viewport-Width',
    name: '视口宽度',
    desc: '单位 CSS px，Deprecated 但仍被广泛发送。',
    type: 'number',
  },
  {
    key: 'viewport-height',
    group: 'high',
    label: 'Viewport-Height',
    name: '视口高度',
    desc: '单位 CSS px，Deprecated 但仍被广泛发送。',
    type: 'number',
  },
  {
    key: 'rtt',
    group: 'high',
    label: 'RTT',
    name: '往返时延 (ms)',
    desc: '网络往返时延的粗粒度估计。',
    type: 'number',
  },
  {
    key: 'downlink',
    group: 'high',
    label: 'Downlink',
    name: '下行带宽 (Mbps)',
    desc: '下行链路速度估计，25 常表示“≥25”。',
    type: 'number',
  },
  {
    key: 'ect',
    group: 'high',
    label: 'ECT',
    name: '有效连接类型',
    desc: 'slow-2g / 2g / 3g / 4g。',
    type: 'raw',
  },
  {
    key: 'sec-ch-prefers-color-scheme',
    group: 'high',
    label: 'Sec-CH-Prefers-Color-Scheme',
    name: '配色偏好',
    desc: 'light 或 dark，对标 prefers-color-scheme。',
    type: 'quoted',
  },
  {
    key: 'sec-ch-prefers-reduced-motion',
    group: 'high',
    label: 'Sec-CH-Prefers-Reduced-Motion',
    name: '减弱动画偏好',
    desc: 'no-preference 或 reduce。',
    type: 'quoted',
  },
  {
    key: 'save-data',
    group: 'other',
    label: 'Save-Data',
    name: '省流量模式',
    desc: '不属于 Client Hints 规范，但常与网络类提示一起出现。',
    type: 'raw',
  },
];

/** 解析 "Chromium";v="140", "Not=A?Brand";v="24" */
export function parseBrandList(value) {
  if (!value) return [];
  const out = [];
  const re = /"([^"]*)"\s*;\s*v\s*=\s*"([^"]*)"/g;
  let m;
  while ((m = re.exec(value)) !== null) {
    const brand = m[1];
    out.push({
      brand,
      version: m[2],
      greasy: /^Not.?A.?Brand$/i.test(brand) || brand.includes('?'),
    });
  }
  return out;
}

function unquote(value) {
  const m = /^"?(.*?)"?$/.exec(value.trim());
  return m ? m[1] : value;
}

/** 把单个 hint 的原始值变成人类可读文本 */
export function describeHint(type, raw) {
  if (raw === undefined) return '—';
  const v = raw.trim();
  switch (type) {
    case 'brands': {
      const brands = parseBrandList(v);
      if (!brands.length) return v || '—';
      return brands
        .map((b) => `${b.brand} ${b.version}${b.greasy ? '（greasy 占位品牌）' : ''}`)
        .join(' · ');
    }
    case 'boolean':
      if (v === '?1') return '是 (?1)';
      if (v === '?0') return '否 (?0)';
      return v;
    case 'quoted':
      return unquote(v) || '空字符串';
    case 'list':
      return v.split(',').map((s) => s.trim()).filter(Boolean).join(' · ') || '—';
    case 'number':
      return v === '' ? '空' : `${v}`;
    default:
      return v === '' ? '空字符串' : v;
  }
}

export function readHints(c) {
  return KNOWN_HINTS.map((h) => {
    const raw = getHeader(c, h.key);
    return { ...h, raw, status: raw === undefined ? 'missing' : 'present', readable: describeHint(h.type, raw) };
  });
}

/** 网络类与嗅探类等“非 UA”提示，单独归类 */
export const NETWORK_HINTS = ['save-data', 'ect', 'rtt', 'downlink'];
