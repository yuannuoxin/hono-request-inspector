// Vercel 入口（Node.js Runtime）
// 用 @hono/node-server 的 getRequestListener 把 (req, res) 桥接成 Hono 的 fetch(app)，
// 这样 c.env.incoming 依然存在，请求头也能保留原始大小写。
// public/ 由 Vercel 自己作为静态资源提供，所以不注册 mountStatic。
import { getRequestListener } from '@hono/node-server';
import { createApp } from '../src/core.js';

const app = createApp();
const listener = getRequestListener(app.fetch);

// 再包一层：Hono 的 onError 只能兜住路由内部的异常，
// 如果异常发生在 Hono 之外（例如构造 Web Request 阶段），
// 平台会把响应换成它自己的空白错误页，什么原因都看不到。
// 这里把这类错误也接住，并把原因写进响应体和运行时日志。
export default function vercelHandler(req, res) {
  try {
    listener(req, res);
  } catch (err) {
    const message = (err && err.message) || String(err);
    console.error('[entry]', req.method, req.url, '::', message);
    console.error(err && err.stack ? err.stack : err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('content-type', 'text/plain; charset=utf-8');
    }
    res.end('entry error: ' + message);
  }
}
