# URL Base64 Convert

浏览器本地运行的 URL/Base64 大文本转换工具，支持普通文本、URL 编码 Base64、原始 Base64 和 Base64URL。

## 为什么现在能处理 20MB+

- 转换逻辑放入 Web Worker，不阻塞页面主线程。
- UTF-8/Base64 按块转换，不再使用 `String.fromCharCode(...超大数组)`。
- 解码时按 Base64 四字符边界分块，并用流式 `TextDecoder` 生成预览。
- 超过 2MB 的结果默认只渲染前 20 万字符，完整结果保存在 Blob 中供复制或下载。
- 可直接选择文本文件，避免把几十 MB 内容粘贴进 DOM 文本框。
- 移除了 Element Plus、Vue DevUI 代码编辑器、JSON Pretty、Pinia 和 UnoCSS 等未使用依赖。

> 实际上限取决于浏览器可用内存。20MB～100MB 建议使用文件模式，并优先下载结果，不要强制“显示完整结果”。

## 开发

```bash
pnpm install
pnpm dev
```

## 构建

```bash
pnpm typecheck
pnpm test:large
pnpm build
pnpm generate
```

静态文件输出到 `.output/public`。仓库中的 GitHub Actions 会将该目录部署到 GitHub Pages；Vercel 也可直接识别 Nuxt 项目。

本地验收使用 21MiB 中英文/Emoji 混合文本完成编码→解码 SHA-256 回环校验，并在真实浏览器中验证了 21MiB 文件编码和 28MiB Base64 文件解码。可运行 `pnpm test:fixtures` 生成浏览器压力测试用文件；它们会写入已忽略的 `tests/tmp`。

GitHub Pages 构建会自动使用 `/UrlBase64Convert/` 子路径；Vercel 和本地构建继续使用根路径 `/`。

## 转换规则

- 编码：UTF-8 文本 → Base64 → `encodeURIComponent` 等价 URL 转义。
- 解码：URL 反转义（如 `%2B`、`%2F`、`%3D`）→ Base64/Base64URL → 原始 UTF-8 字节。
- 所有处理均在本机浏览器中完成，不会上传输入内容。
