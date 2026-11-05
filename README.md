# Hono Request Inspector

一个用 [Hono](https://hono.dev/) 写的请求特征查看器：把一次普通 HTTP 请求里能被拿到的身份信号，分四个页面逐层拆开。同一份代码可以跑在 Node、Cloudflare Workers、Cloudflare Pages、Vercel 上。

| 页面 | 路径 | 干什么 |
|---|---|---|
| 总览 | `/` | 当前请求的浏览器 / 系统 / 设备 / IP / 运行时概览，四个功能的入口 |
| UA 解析 | `/ua` | `ua-parser-js` 拆解 User-Agent，指出 UA Reduction 冻结了哪些字段，并用 Client Hints 校正 |
| Client Hints | `/client-hints` | 逐项解析 `Sec-CH-*`，区分低熵 / 高熵，并与浏览器端 `navigator.userAgentData` 对照 |
| 请求头全量 | `/headers` | 展示收到的全部请求头，支持搜索、分组、JSON、与 fetch 请求对比 |
| Fingerprint v5 | `/fingerprint` | 在浏览器里跑 FingerprintJS v5 开源版，输出 visitorId / 置信度 / 42 个组件，并回传服务端做漂移比对 |

## 本地运行

```bash
npm install
npm run dev          # node --watch，改代码自动重启
```

打开 http://localhost:3000 。

```bash
npm start                 # 不监听文件变化
PORT=3001 npm run dev     # 换端口（PowerShell: $env:PORT=3001; npm run dev）
HOST=0.0.0.0 npm run dev  # 允许局域网访问，见「常见问题」
npm run smoke             # 冒烟测试（服务需已启动）
```

## 部署

三个平台的入口和配置都已经放在仓库里，不需要再改代码。

### Cloudflare Workers

```bash
npx wrangler login        # 只需一次
npm run deploy:cf         # = wrangler deploy
npm run dev:cf            # = wrangler dev，本地跑真实 Workers 环境（默认 8787 端口）
```

配置在 `wrangler.toml`：

```toml
name = "hono-request-inspector"
main = "src/worker.js"
compatibility_date = "2025-10-01"

[assets]
directory = "./public"
binding = "ASSETS"
```

`public/` 会作为 Workers Assets 一起上传（共 8 个文件，Worker 本体 gzip 后约 47 KiB），命中静态文件的请求由 Cloudflare 直接返回，不进 Worker。

### Cloudflare Pages

两种方式，二选一：

**A. 连 Git 仓库**（推荐，推代码即部署）

| 设置项 | 值 |
|---|---|
| 框架预设 | None |
| 构建命令 | `npm ci` |
| 构建输出目录 | `public` |

**构建命令不能留空。** Pages 只有在执行构建命令时才会安装依赖；留空就会跳过构建直接去打包 `functions/`，那时没有 `node_modules`，报 `Could not resolve "hono"` / `Could not resolve "ua-parser-js"` 并失败。

如果构建环境的 Node 低于 20（`package.json` 的 `engines.node` 要求 `>=20`），在环境变量里加 `NODE_VERSION=20`。

`functions/` 会被自动识别并打包，跨目录 import（`../src/core.js`）是支持的。日志里那句 `A Wrangler configuration file was found but it does not appear to be valid` 属于预期提示——`wrangler.toml` 是 Workers 的配置，Pages 的构建参数在 Dashboard 里，两者互不干扰。

**B. 命令行**

```bash
npm run deploy:pages   # = wrangler pages deploy public --project-name=hono-request-inspector
```

Pages 会优先返回静态文件，剩下的路径交给 `functions/[[path]].js`（内部调用 `hono/cloudflare-pages` 的 `handle`）。

### Vercel

```bash
npx vercel login
npm run deploy:vercel   # = vercel --prod
npm run dev:vercel      # = vercel dev
```

或者连 Git 仓库，Framework 选 Other，构建命令与输出目录都留空。

- `api/index.js`：Node runtime 入口，用 `@hono/node-server` 的 `getRequestListener` 把 `(req, res)` 桥接给 Hono
- `vercel.json`：把非静态路径 rewrite 到 `/api`；`public/` 由 Vercel 自己作为静态资源提供

本地不装 Vercel CLI 也能验证这个入口：

```bash
npm run check:vercel    # 用纯 Node http 直接跑 api/index.js
```

**为什么根路径 `/` 会 500？**

Vercel 的 Node runtime 会按约定探测服务入口，搜索顺序是：

```
app.{js,cjs,mjs,ts,cts,mts}
index.{js,cjs,mjs,ts,cts,mts}
server.{js,cjs,mjs,ts,cts,mts}
src/app.{js,cjs,mjs,ts,cts,mts}
src/index.{js,cjs,mjs,ts,cts,mts}
src/server.{js,cjs,mjs,ts,cts,mts}
```

**根路径 `/` 交给这个入口，其余路径才走 `vercel.json` 的 rewrite 到 `/api`。** 所以：

- 探测到 `src/app.js` 但它只有命名导出（`export function createApp`）→ 运行时日志报 `Invalid export found in module ... The default export must be a function or server`，进程退出 1，外部表现为 `500 FUNCTION_INVOCATION_FAILED`，而 `/ua`、`/headers` 全部正常。
- 干脆改名躲开探测 → 构建直接失败 `Error: No entrypoint found.`。

正确的做法是**提供这个入口并让它合法**：本项目 `src/app.js` 的 default export 就是一个 `getRequestListener(createApp().fetch)`，`core.js` 里的工厂保持平台无关。

另外注意：**Vercel 项目如果只通过 CLI 部署，push 到 GitHub 不会触发重新部署**，改完要自己 `npm run deploy:vercel` 或到 Dashboard 点 Redeploy。

## 目录结构

```
src/
  core.js                平台无关的 Hono 应用（路由 / 中间件 / API）
  main-node.js           Node 入口：@hono/node-server + serveStatic
  app.js                 Vercel 专用入口（满足 Vercel 对 Node 服务入口的探测）
  worker.js              Cloudflare Workers 入口：ASSETS binding
  lib/
    util.js              转义、请求头读取、远端地址、运行时识别
    ua.js                ua-parser-js 封装 + UA Reduction 检查
    hints.js             Client Hints 字段表、解析、品牌列表
  views/                 layout / overview / ua / hints / headers / fingerprint
public/
  static/
    styles.css           深色主题
    common.js            复制按钮
    hints.js             navigator.userAgentData 对照
    headers.js           搜索 / 过滤 / fetch 差异对比
    fingerprint.js       FingerprintJS 计算与回传
    vendor/fp.min.js     从 @fingerprintjs/fingerprintjs 复制的开源版浏览器包
functions/
  [[path]].js            Cloudflare Pages Functions 入口
api/
  index.js               Vercel 入口
wrangler.toml            Workers / Pages 配置
vercel.json              Vercel 路由
scripts/
  smoke.mjs              HTTP 冒烟测试（可用 BASE 指向任意部署）
  vercel-check.mjs       Vercel 入口的本地验证
```

## 各平台行为差异

同一份代码，不同平台能拿到的信息不一样，页面里已经如实体现：

| 能力 | Node | Cloudflare Workers / Pages | Vercel |
|---|---|---|---|
| 请求头来源 | `incoming.rawHeaders` | 标准 `Headers` | `rawHeaders`（经 getRequestListener） |
| 头部大小写 / 顺序 | 保留（含重复头） | 全部小写，同名头被合并 | 保留 |
| 静态资源 | `serveStatic` | `ASSETS` binding | `public/` 目录 |
| 远端 IP | socket / `X-Forwarded-For` | `CF-Connecting-IP` | `X-Forwarded-For` |
| HTTP 版本 | 真实值 | 无版本信息（页面显示 `HTTP/2+`） | `HTTP/2` |
| 指纹归档 | 进程内存 | 当前 isolate 内存 | 当前实例内存 |

**注意**：`/` 页面顶部会显示当前请求落在哪个运行时（Node.js / Cloudflare / Vercel），部署后一眼就能确认。

## 几个实现要点

**1. 高熵 Client Hints 靠响应头协商**

`src/core.js` 的中间件在每个响应里写：

```js
c.header('Accept-CH', CH_LIST)    // 下一次请求带哪些高熵提示
c.header('Critical-CH', CH_LIST)  // 缺失时让浏览器立刻重发一次补齐
c.header('Vary', CH_LIST)
```

没有 `Critical-CH` 就要手动刷新两次才能看到高熵值；加上之后首次访问就会自动重发。实测 Chrome 147 首次加载即可拿到 16/17 项（唯一拿不到的 `Sec-CH-UA-Full-Version` 已被 Chrome 废弃）。

**2. 请求头优先读 `rawHeaders`**

`Headers` 对象会合并同名头、键全部小写。Node 下用 `c.env.incoming.rawHeaders` 的扁平数组 `[name, value, name, value...]` 能原样展示；Workers 上没有这个数组，`headerPairs()` 自动退回 `Headers` 迭代。

**3. 静态资源放 `public/static/`**

URL `/static/styles.css` 在三端都直接对应 `public/static/styles.css`：Node 的 `serveStatic({ root: './public' })`、Workers 的 ASSETS、Vercel 的 `public/` 都不需要额外 rewrite。

**4. Node 专属的东西只在入口出现**

`core.js` 不 import `@hono/node-server`、不读 `process.env`，所以能被 Workers 直接打包。平台差异通过 `createApp({ mountStatic })` 注入。

**5. FingerprintJS 用本地包**

`fp.min.js` 来自 npm 包而非 CDN，离线可用、版本可控。开源版 `FingerprintJS.load()` 不需要 API Key。注意 v5 的 `confidence.comment` 里带 Pro 版推广链接和 `utm_` 参数，页面里已过滤成中性文案。

## 常见问题

**Pages 构建报 `Could not resolve "hono"`？**
构建命令留空了，Pages 没装依赖。Settings → Build & deployments 里把构建命令设成 `npm ci`、输出目录 `public`，保存后 Retry deployment。

**高熵提示全是空的？**
- 只有 Chromium 系浏览器支持（Firefox 基本不支持，Safari 支持一部分）。
- 必须安全上下文：`https://`，或 `localhost` / `127.0.0.1`。用局域网 IP 走 http 访问时浏览器不会发送高熵提示，这是浏览器策略，不是代码问题。部署到 Workers / Pages / Vercel 后都是 https，不会有这个问题。

**UA 里是 Windows 10，但机器是 Win 11？**
Chrome 的 UA Reduction 让所有 Win10/11 都写成 `Windows NT 10.0`。`/ua` 页面用 `Sec-CH-UA-Platform-Version` 做了校正（19.0.0 → Windows 11 24H2/25H2）。

**指纹归档数据会丢吗？**
会。`fpStore` 是内存 Map，serverless 平台下实例重启或换副本就会清空，多实例之间也不共享。要做真实统计需要换成 Workers KV / D1 / Durable Objects，或 Vercel 侧的 Upstash / Postgres。当前实现只用于演示「同一设备多次访问，组件是否漂移」。

**Workers 上 `wrangler dev` 显示运行时是 Cloudflare？**
是的。`runtimeLabel` 先看 `cf-ray` / `ASSETS` binding，再看 `incoming`；本地 wrangler dev 没有 `cf-ray`，靠 ASSETS binding 识别。

**需要 TypeScript？**
当前是纯 JS + ESM（`"type": "module"`），零构建步骤。要转 TS 把 `src/**/*.js` 改成 `.ts` 并装 `tsx` 即可，Hono 自带类型。
