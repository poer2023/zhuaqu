一个用于“X 内容入库/同步 → AI 强改写 → 审核 → 定时发布”的自建系统（Next.js + Prisma + PostgreSQL）。

重构版本引入统一编排 `Job/Step`（Step 表充当队列），并提供 `/jobs` 任务中心用于追踪、重试、从某步重跑。

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL
- `yt-dlp`（用于解析 X 视频直链）
- `ffmpeg`（用于后续视频处理/抽帧/转码；当前已可选）
- Playwright Chromium（Sync/Publish 需要登录会话）

macOS:

```bash
brew install yt-dlp ffmpeg
npx playwright install chromium
```

### Setup

1) 安装依赖

```bash
npm install
```

2) 配置环境变量

```bash
cp env.example .env
```

至少需要配置：

- `DATABASE_URL`
- `OPENAI_API_KEY`（用于改写；不配则使用 mock 输出）

可选：

- `GEMINI_API_KEY`（仅 `/video-to-thread` 需要）
- `YTDLP_COOKIES`（当 X 对部分内容要求登录态时）

3) 初始化数据库

```bash
npm run db:push
npm run db:seed
```

### Run (Dev)

需要同时跑 Web 和 worker（worker 负责后台入库下载）：

```bash
npm run dev
```

另开一个终端：

```bash
npm run worker
# 或拆分角色
WORKER_ROLE=capture  npm run worker
WORKER_ROLE=pipeline npm run worker
WORKER_ROLE=publish  npm run worker
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 关键接口（当前）

- `POST /api/ingest/jobs`：创建入库任务（写入 Job/Step，worker 领取 CAPTURE 执行）
- `GET /api/ingest/jobs/:jobId`：查询入库任务进度
- `POST /api/sync/jobs`：创建自动同步任务（LIKES/BOOKMARKS/TIMELINE）
- `POST /api/rewrite/stream`：SSE 订阅式改写（worker 执行 REWRITE step，增量写入 Step.outputRef）
- `POST /api/publish/jobs`：创建发布任务（支持 scheduledAt，worker 到点发布）
- `GET /api/jobs` / `GET /api/jobs/:id`：统一任务中心（含 steps 时间线）
- `POST /api/steps/:id/retry` / `POST /api/jobs/:id/rerun-from`：重试/重跑
- `GET /api/content-items/:itemId/media/:mediaIndex/download`：下载已落盘的视频
- `POST /api/content-items/:itemId/video-to-thread`：用 Gemini 把视频生成“可发线程”的结构化稿（写入 `RewriteVersion`）

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
