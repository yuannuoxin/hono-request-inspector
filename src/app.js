// Vercel 专用入口
//
// Vercel 的 Node runtime 会按约定探测 app.js / index.js / server.js（根目录与 src/ 下）
// 作为"服务入口"，根路径 / 会交给它；其余路径由 vercel.json 的 rewrite 走 api/index.js。
// 所以这个文件必须存在，且 default export 必须是一个合法的 Node handler。
//
// 真正的应用工厂在 core.js —— 那里保持平台无关，不 import 任何 Node 专属模块。

import { getRequestListener } from '@hono/node-server';
import { createApp } from './core.js';

// public/ 由 Vercel 自己作为静态资源提供，这里不注册 mountStatic
export default getRequestListener(createApp().fetch);
