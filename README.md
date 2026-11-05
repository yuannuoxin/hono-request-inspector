# Hono Request Inspector

一个用 [Hono](https://hono.dev/) 写的请求特征查看器：把一次普通 HTTP 请求里能被拿到的身份信号，分四个页面逐层拆开。

| 页面 | 路径 | 干什么 |
|---|---|---|
| 总览 | `/` | 当前请求的浏览器 / 系统 / 设备 / IP 概览，四个功能的入口 |
| UA 解析 | `/ua` | `ua-parser-js` 拆解 User-Agent，并指出 Chrome 的 UA Reduction 冻结了哪些字段 |
| Client Hints | `/client-hints` | 逐项解析 `Sec-CH-*`，区分低熵 / 高熵，并与浏览器端 `navigator.userAgentData` 对照 |
| 请求头全量 | `/headers` | 展示 Node 收到的全部原始头（保留大小写与顺序），支持搜索、分组、JSON、与 fetch 请求对比 |
| Fingerprint v5 | `/fingerprint` | 在浏览器里跑 FingerprintJS v5 开源版，输出 visitorId / 置信度 / 42 个组件，并回传服务端做漂移比对 |

## 快速开始

```bash
npm install
npm run dev          # node --watch，改代码自动重启
```

打开 http://localhost:3000 。

```bash
npm start            # 不监听文件变化
PORT=3001 npm run dev  # 换端口（PowerShell: $env:PORT=3001; npm run dev）
HOST=0.0.0.0 npm run dev  # 允许局域网访问，注意下面第 3 条
```

冒烟测试（服务需已启动）：

```bash
node scripts/smoke.mjs
```

## 目录结构

```
src/
  server.js              Hono 路由、Accept-CH 中间件、指纹归档 API
  lib/
    util.js              HTML 转义、原始请求头读取、远端地址
    ua.js                ua-parser-js 封装 + UA Reduction 检查
    hints.js             Client Hints 字段表、解析、品牌列表
  views/
    layout.js            页面骨架、卡片、表格、代码块组件
    overview.js  ua.js  hints.js  headers.js  fingerprint.js
public/
  styles.css             深色主题
  common.js              复制按钮
  hints.js               navigator.userAgentData 对照
  headers.js             搜索 / 过滤 / fetch 差异对比
  fingerprint.js         FingerprintJS 计算与回传
  vendor/fp.min.js       从 @fingerprintjs/fingerprintjs 复制的开源版浏览器包
scripts/
  smoke.mjs              HTTP 冒烟测试
```

## 几个实现要点

**1. 高熵 Client Hints 靠响应头协商**

`src/server.js` 的中间件在每个响应里写：

```js
c.header('Accept-CH', CH_LIST)    // 下一次请求带哪些高熵提示
c.header('Critical-CH', CH_LIST)  // 缺失时让浏览器立刻重发一次补齐
c.header('Vary', CH_LIST)
```

没有 `Critical-CH` 就要手动刷新两次页面才能看到高熵值；加上之后首次访问就会自动重发。实测 Chrome 147 首次加载即可拿到 16/17 项（唯一拿不到的 `Sec-CH-UA-Full-Version` 已被 Chrome 废弃）。

**2. 请求头用 `rawHeaders` 读，而不是 `Headers`**

`Headers` 对象会合并同名头、丢失原始大小写。`c.env.incoming.rawHeaders` 是扁平数组 `[name, value, name, value...]`，能原样展示。`headerPairs()` 在拿不到 `incoming` 时自动退回 `Headers` 迭代。

**3. FingerprintJS 用本地包**

`fp.min.js` 来自 npm 包而非 CDN，所以离线可用、版本可控、不依赖指纹服务商的可用性。开源版 `FingerprintJS.load()` 不需要 API Key。

注意开源版 v5 的 `confidence.comment` 里会带 Pro 版推广链接和 `utm_` 参数，页面里已过滤成中性文案。

**4. 指纹结果在服务端做漂移比对**

`POST /api/fingerprint` 按 visitorId 归档（内存 Map，最多 500 条），再次访问时逐组件比 JSON 值，把变化项返回给页面 —— 判断“同一台设备 ID 是否稳定”靠这个，而不是靠单次结果。

## 常见问题

**高熵提示全是空的？**
- 只有 Chromium 系浏览器支持（Firefox 基本不支持，Safari 支持一部分）。
- 必须安全上下文：`https://`，或 `localhost` / `127.0.0.1`。用 `http://192.168.x.x:3000` 访问时浏览器不会发送高熵提示，这是浏览器策略，不是代码问题。

**UA 里是 Windows 10，但机器是 Win 11？**
这是 Chrome 的 UA Reduction 造成的，所有 Win10/11 都写成 `Windows NT 10.0`。`/ua` 页面用 `Sec-CH-UA-Platform-Version` 做了校正（19.0.0 → Windows 11 24H2/25H2）。

**需要 TypeScript？**
当前是纯 JS + ESM（`"type": "module"`），零构建步骤。要转 TS 只需把 `src/**/*.js` 改成 `.ts` 并加 `tsx`，Hono 的类型提示在 `hono` 包里自带。
