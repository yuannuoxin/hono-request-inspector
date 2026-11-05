// Cloudflare Workers 入口
// 静态资源走 Workers Static Assets（wrangler.toml 里的 [assets] binding）
import { createApp } from './core.js';

const app = createApp({
  mountStatic: (app) =>
    app.use('/static/*', (c) => {
      // ASSETS 存在就交给静态资源，否则交给下面的 notFound
      if (c.env && c.env.ASSETS && typeof c.env.ASSETS.fetch === 'function') {
        return c.env.ASSETS.fetch(c.req.raw);
      }
      return c.notFound();
    }),
});

export default app;
