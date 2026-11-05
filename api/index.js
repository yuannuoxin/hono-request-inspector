// Vercel 入口（Node.js Runtime）
// 用 @hono/node-server 的 getRequestListener 把 (req, res) 桥接成 Hono 的 fetch(app)，
// 这样 c.env.incoming 依然存在，请求头也能保留原始大小写。
// public/ 由 Vercel 自己作为静态资源提供，所以不注册 mountStatic。
import { getRequestListener } from '@hono/node-server';
import { createApp } from '../src/app.js';

const app = createApp();

export default getRequestListener(app.fetch);
