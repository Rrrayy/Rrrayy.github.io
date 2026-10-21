# Rray Personal Site

基于 Astro 构建的静态个人网站，发布到 `https://rrrayy.github.io/`。

## 本地开发

需要 Node.js `>=22.22.0` 和 npm `>=9.6.5`。

```sh
npm ci
npm run dev
```

开发服务器默认运行于 `http://localhost:4321`。

## 校验与构建

```sh
npm run check
npm run build
npm run preview
```

构建产物输出到 `dist/`，可由 GitHub Pages 静态托管。

## 内容维护

- 已发布文章原稿保存在 `blog/content/`，文章展示元数据保存在 `src/data/articles.json`。
- 个人信息、技术栈、Job Desk、EvidenceOps 与 RPC 的首页资料保存在 `src/data/site.ts`。
- GitHub Pages 的构建与发布工作流位于 `.github/workflows/deploy-pages.yml`。
- `blog/content/` 中只维护已公开发布的 CSDN 文章；更新文章时同步标题、日期、原文链接和摘要。

GitHub Pages 仓库设置的发布源需选择 **GitHub Actions**。
