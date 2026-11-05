// Vercel 专用入口
//
// Vercel 的 Node runtime 会按约定探测 app.js / index.js / server.js（根目录与 src/ 下）
// 作为"服务入口"，根路径 / 交给它；其余路径由 vercel.json 的 rewrite 走 api/index.js。
// 所以这个文件必须存在，且 default export 必须是一个合法的 Node handler。
//
// 另外 Vercel 会检查入口文件是否直接 import 'hono' —— 没有就会报
// "No entrypoint found which imports hono. Found possible entrypoint: src/app.js"，
// 所以这里保留对 Hono 的直接引用，并用它做一次实例校验。
//
// 真正的应用工厂在 core.js —— 那里保持平台无关，不 import 任何 Node 专属模块。

import { Hono } from 'hono';
import { getRequestListener } from '@hono/node-server';
import { createApp } from './core.js';

// public/ 由 Vercel 自己作为静态资源提供，这里不注册 mountStatic
const app = createApp();

if (!(app instanceof Hono)) {
  throw new TypeError('createApp() 必须返回 Hono 实例');
}

export default getRequestListener(app.fetch);
