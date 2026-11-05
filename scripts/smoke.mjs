// 冒烟测试：node scripts/smoke.mjs
const BASE = process.env.BASE || 'http://127.0.0.1:3000';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

const BROWSER_HEADERS = {
  'User-Agent': UA,
  'sec-ch-ua': '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'sec-ch-ua-platform-version': '"19.0.0"',
  'sec-ch-ua-arch': '"x86"',
  'sec-ch-ua-bitness': '"64"',
  'sec-ch-ua-full-version-list':
    '"Chromium";v="140.0.7339.128", "Not=A?Brand";v="24.0.0.0", "Google Chrome";v="140.0.7339.128"',
  'sec-ch-ua-form-factors': '"Desktop"',
  'device-memory': '8',
  dpr: '1.25',
  'viewport-width': '1536',
  'sec-ch-prefers-color-scheme': 'light',
  'accept-language': 'zh-CN,zh;q=0.9',
  cookie: 'sid=abc123; theme=dark',
  'x-forwarded-for': '203.0.113.9',
};

let failures = 0;

function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  ✔ ${name}${detail ? ' — ' + detail : ''}`);
  } else {
    failures += 1;
    console.log(`  ✘ ${name}${detail ? ' — ' + detail : ''}`);
  }
}

async function get(path) {
  const res = await fetch(BASE + path, { headers: BROWSER_HEADERS });
  return { status: res.status, text: await res.text(), headers: res.headers };
}

console.log(`\n[1] 页面与静态资源  (${BASE})`);
const pages = ['/', '/ua', '/client-hints', '/headers', '/fingerprint'];
for (const p of pages) {
  const r = await get(p);
  check(`GET ${p}`, r.status === 200, `HTTP ${r.status}`);
}
for (const p of ['/static/styles.css', '/static/vendor/fp.min.js', '/static/common.js', '/static/hints.js', '/static/headers.js', '/static/fingerprint.js']) {
  const r = await get(p);
  check(`GET ${p}`, r.status === 200, `HTTP ${r.status}, ${r.text.length} bytes`);
}

console.log('\n[2] Accept-CH / Critical-CH 协商头');
const home = await get('/');
const acceptCh = home.headers.get('accept-ch') || '';
check('Accept-CH 已设置', acceptCh.includes('Sec-CH-UA-Platform-Version'), `${acceptCh.split(',').length} 个字段`);
check('Critical-CH 已设置', (home.headers.get('critical-ch') || '').includes('Sec-CH-UA-Arch'));

console.log('\n[3] UA 解析内容');
const uaPage = (await get('/ua')).text;
check('识别浏览器 Chrome 140', uaPage.includes('Chrome 140'));
check('识别引擎 Blink', uaPage.includes('Blink'));
check('识别系统 Windows', uaPage.includes('Windows NT 10.0'));
check('UA Reduction 提示出现', uaPage.includes('UA Reduction'));
check('greasy 品牌被标记', uaPage.includes('greasy 占位'));

console.log('\n[4] Client Hints 解析内容');
const hintsPage = (await get('/client-hints')).text;
check('解析出平台版本 19.0.0', hintsPage.includes('19.0.0'));
check('解析出架构 x86', hintsPage.includes('x86'));
check('只读布尔值 ?0 转成中文“否”', hintsPage.includes('否 (?0)'));
check('设备形态 Desktop', hintsPage.includes('Desktop'));
check('未发送的高熵项有占位', hintsPage.includes('未发送'));

console.log('\n[5] 请求头页面');
const headersPage = (await get('/headers')).text;
check('包含 Cookie 原始值', headersPage.includes('sid=abc123'));
check('包含 X-Forwarded-For', headersPage.includes('x-forwarded-for'));
check('包含 device-memory', headersPage.includes('device-memory'));
const api = await (await fetch(BASE + '/api/headers', { headers: BROWSER_HEADERS })).json();
check('/api/headers 返回 JSON', api.headerCount > 10, `${api.headerCount} 个头`);
check('/api/headers 保留原始 UA', api.headers['user-agent'] === UA);

console.log('\n[6] Fingerprint v5 归档接口');
const vid = 'abcdef0123456789abcdef0123456789';
const first = await (
  await fetch(BASE + '/api/fingerprint', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...BROWSER_HEADERS },
    body: JSON.stringify({
      visitorId: vid,
      confidence: 0.93,
      components: { canvas: { value: 'aaa', duration: 10 }, timezone: { value: 'Asia/Shanghai', duration: 2 } },
    }),
  })
).json();
check('首次上报成功', first.ok === true, `visits=${first.visits}`);

const second = await (
  await fetch(BASE + '/api/fingerprint', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...BROWSER_HEADERS },
    body: JSON.stringify({
      visitorId: vid,
      confidence: 0.93,
      components: { canvas: { value: 'bbb', duration: 10 }, timezone: { value: 'Asia/Shanghai', duration: 2 } },
    }),
  })
).json();
check('第二次访问计数 +1', second.visits === first.visits + 1, `visits=${second.visits}`);
check('检测到 canvas 组件漂移', second.changed.length === 1 && second.changed[0].key === 'canvas');
check('stable 标记为 false', second.stable === false);

const bad = await fetch(BASE + '/api/fingerprint', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ visitorId: '<script>alert(1)</script>' }),
});
check('非法 visitorId 返回 400', bad.status === 400, `HTTP ${bad.status}`);

const badJson = await fetch(BASE + '/api/fingerprint', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: '{oops',
});
check('非法 JSON 返回 400', badJson.status === 400, `HTTP ${badJson.status}`);

console.log(`\n结果：${failures === 0 ? '全部通过' : failures + ' 项失败'}\n`);
process.exit(failures === 0 ? 0 : 1);
