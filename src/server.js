// Node.js 入口：npm run dev / npm start
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { createApp } from './app.js';

const app = createApp({
  // 本地文件服务：URL /static/styles.css -> ./public/static/styles.css
  mountStatic: (app) => app.use('/static/*', serveStatic({ root: './public' })),
});

const port = Number(process.env.PORT || 3000);
const hostname = process.env.HOST || '127.0.0.1';

serve({ fetch: app.fetch, port, hostname }, (info) => {
  console.log(`\n  Hono Request Inspector 已启动`);
  console.log(`  → http://localhost:${info.port}`);
  console.log(`  → UA 解析        http://localhost:${info.port}/ua`);
  console.log(`  → Client Hints   http://localhost:${info.port}/client-hints`);
  console.log(`  → 请求头全量      http://localhost:${info.port}/headers`);
  console.log(`  → Fingerprint v5 http://localhost:${info.port}/fingerprint\n`);
});
