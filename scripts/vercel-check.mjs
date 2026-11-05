// 本地验证 Vercel 入口（api/index.js）能否在纯 Node http 下工作。
// Vercel 线上会把 public/ 作为静态资源直接提供，这里只验证 Function 侧。
//   node scripts/vercel-check.mjs
import { createServer } from 'node:http';
import handler from '../api/index.js';

const PORT = Number(process.env.PORT || 3210);

const server = createServer((req, res) => handler(req, res));
await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));

const BASE = `http://127.0.0.1:${PORT}`;
const HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
  'sec-ch-ua': '"Chromium";v="140", "Not=A?Brand";v="24", "Google Chrome";v="140"',
  'sec-ch-ua-platform': '"Windows"',
};

let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? '✔' : '✘'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failed += 1;
};

console.log('\n[Vercel 入口 · Node http 直跑]');
for (const path of ['/', '/ua', '/client-hints', '/headers', '/fingerprint']) {
  const res = await fetch(BASE + path, { headers: HEADERS });
  const body = await res.text();
  check(`GET ${path}`, res.status === 200 && body.length > 500, `HTTP ${res.status}, ${body.length} bytes`);
}

const apiRes = await fetch(BASE + '/api/headers', { headers: HEADERS });
const api = await apiRes.json();
check('/api/headers 返回 JSON', apiRes.status === 200 && api.headerCount > 5, `${api.headerCount} 个头`);
check('无 Node env 时能降级读头', api.headers['user-agent'] === HEADERS['user-agent']);
check('运行时被识别为 Vercel', (await (await fetch(BASE + '/', { headers: { ...HEADERS, 'x-vercel-id': 'test::abc' } })).text()).includes('Vercel'));

server.close();
console.log(`\n结果：${failed === 0 ? '全部通过' : failed + ' 项失败'}\n`);
process.exit(failed === 0 ? 0 : 1);
