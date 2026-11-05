// Cloudflare Pages Functions 入口（捕获所有路径）
// Pages 会先尝试静态文件，命中 public/static/* 就直接返回，不会进到这里
import { handle } from 'hono/cloudflare-pages';
import { createApp } from '../src/core.js';

const app = createApp({
  mountStatic: (app) =>
    app.use('/static/*', (c) => {
      if (c.env && c.env.ASSETS && typeof c.env.ASSETS.fetch === 'function') {
        return c.env.ASSETS.fetch(c.req.raw);
      }
      return c.notFound();
    }),
});

export const onRequest = handle(app);
