# ZhaQu 开发文档

> 内容采集、改写、发布一体化平台  
> 版本: 0.2.0 | 更新日期: 2025-12-16

---

## 目录

1. [项目概述](#项目概述)
2. [技术栈](#技术栈)
3. [快速开始](#快速开始)
4. [项目结构](#项目结构)
5. [核心功能模块](#核心功能模块)
6. [数据模型](#数据模型)
7. [API 端点](#api-端点)
8. [状态管理](#状态管理)
9. [路由结构](#路由结构)
10. [开发指南](#开发指南)
11. [常见问题](#常见问题)

---

## 项目概述

ZhaQu 是一个内容运营平台，核心功能：

1. **内容采集 (Capture)** - 从 X/Twitter 批量抓取推文
2. **AI 改写 (Rewrite)** - 使用 Gemini AI 进行内容改写
3. **定时发布 (Publish)** - 管理发布队列并定时发布
4. **自动同步 (Sync)** - 从点赞/书签自动同步内容

### 工作流

```
控制面（页面/API）→ 创建统一编排任务（Job/Step）→ worker 执行 → 写入业务模型

Ingest/Sync:
URL/来源 → /api/ingest/jobs 或 /api/sync/jobs
        → Job(type=INGEST_URL|SYNC_*) + Step(CAPTURE)
        → worker(capture) → ContentItem(captureStatus: QUEUED/FETCHING/READY/FAILED)

Rewrite:
/api/rewrite/stream（SSE 订阅）或 /api/rewrite/batches（异步）
        → Job(type=REWRITE) + Step(REWRITE)
        → worker(pipeline) → RewriteVersion(GENERATED) → 人工审核(APPROVED/REJECTED/REWORK)

Publish:
/api/publish/jobs
        → Job(type=PUBLISH) + Step(PUBLISH, availableAt=scheduledAt)
        → worker(publish) → PublishResult

所有任务/步骤在 /jobs 里统一可追踪、可重试、可从某步重跑。
```

---

## 技术栈

| 类别 | 技术 |
|------|------|
| **框架** | Next.js 16 (App Router, Turbopack) |
| **语言** | TypeScript |
| **数据库** | PostgreSQL + Prisma 7 |
| **状态管理** | Zustand |
| **UI 组件** | shadcn/ui + Radix UI |
| **样式** | Tailwind CSS 4 |
| **AI** | OpenAI（Rewrite）+ Gemini（Video → Thread） |
| **爬虫** | yt-dlp + Playwright |
| **国际化** | 自定义 i18n (en/zh) |

---

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `env.example` 为 `.env` 并填写：

```env
# 数据库
DATABASE_URL="postgresql://user:password@localhost:5432/zhaqu"

# Rewrite（可选：不配则使用 mock 输出）
OPENAI_API_KEY="your-openai-api-key"
OPENAI_MODEL="gpt-4o-mini"

# Video → Thread（可选：仅 /video-to-thread 需要）
GEMINI_API_KEY="your-gemini-api-key"
GEMINI_MODEL="gemini-2.5-flash"

# 本地媒体存储
MEDIA_DIR="data/media"

# yt-dlp (可选，用于视频下载)
YTDLP_COOKIES=""

# Worker
WORKER_POLL_INTERVAL_MS="2000"
WORKER_ROLE="all" # all | capture | pipeline | publish

# Playwright / X Session
PUBLISH_HEADLESS="true"
X_USER_AGENT=""

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret"
```

### 3. 初始化数据库

```bash
npm run db:push    # 推送 schema 到数据库
npm run db:seed    # 可选：填充测试数据
```

### 4. 启动开发服务器

```bash
npm run dev        # 启动 Next.js 开发服务器
npm run worker     # 启动后台任务处理器 (另一个终端)
```

可按职责拆 worker（多进程/多实例安全）：

```bash
WORKER_ROLE=capture  npm run worker
WORKER_ROLE=pipeline npm run worker
WORKER_ROLE=publish  npm run worker
```

### 5. 访问应用

打开 http://localhost:3000

---

## 项目结构

```
zhaqu/
├── prisma/
│   └── schema.prisma        # 数据库模型定义
├── src/
│   ├── app/                  # Next.js App Router
│   │   ├── api/              # API 路由
│   │   ├── content/          # 内容管理页面
│   │   ├── automation/       # 自动化/同步页面
│   │   ├── publish/          # 发布管理页面
│   │   └── settings/         # 设置页面
│   ├── components/           # React 组件
│   │   ├── layout/           # 布局组件 (Sidebar, PageShell, TopBar)
│   │   ├── pools/            # 素材池相关组件
│   │   ├── content/          # 内容相关组件
│   │   └── ui/               # shadcn/ui 基础组件
│   ├── server/               # 服务端逻辑
│   │   ├── ai/               # AI（rewrite + video-to-thread）
│   │   ├── ingest/           # 单条内容入库逻辑
│   │   ├── orchestrator/     # 统一 Job/Step 编排 + handlers
│   │   ├── jobs/             # 旧 job 执行逻辑（逐步迁移到 orchestrator）
│   │   ├── sync/             # 同步抓取（Playwright session）
│   │   ├── media/            # 媒体下载/存储
│   │   ├── publish/          # Playwright 发布执行
│   │   └── x/                # X/Twitter 集成
│   ├── stores/               # Zustand 状态管理
│   ├── i18n/                 # 国际化翻译
│   ├── lib/                  # 工具函数
│   └── middleware.ts         # 路由重定向中间件
├── scripts/
│   └── worker.ts             # 后台任务处理脚本
├── extension/                # 浏览器扩展 (用于 Cookie 获取)
└── data/
    └── media/                # 本地媒体存储目录
```

---

## 核心功能模块

### 1. 内容采集 (Ingest)

**入口**: `/content/ingest`

**流程**:
1. 用户粘贴 X/Twitter URL 列表
2. 前端校验 URL 格式，统计有效/重复/无效
3. 调用 `/api/ingest/jobs` 创建 IngestJob，同时创建 Job(type=INGEST_URL)+Step(CAPTURE)
4. worker（role=capture）通过 Step 表“领任务”执行：
   - 解析 URL → X GraphQL / yt-dlp 抓取 → 创建 ContentItem（自动去重）
   - 可选下载媒体到本地 `MEDIA_DIR`
5. 任务与步骤在 `/jobs` 可追踪/重试/重跑

**核心文件**:
- `src/app/content/ingest/page.tsx` - 采集页面
- `src/app/api/ingest/jobs/route.ts` - 创建任务 API
- `src/server/ingest/ingestTweet.ts` - 单条 URL 入库与去重
- `src/server/jobs/ingest.ts` - IngestJob 执行（由 orchestrator 调用）
- `src/server/orchestrator/handlers/capture.ts` - CAPTURE step handler
- `src/server/x/ytDlp.ts` - yt-dlp 封装
- `scripts/worker.ts` - Step queue consumer

### 2. AI 改写 (Rewrite)

**入口**: `/content/[id]/rewrite`

**流程**:
1. 选择改写预设 (RewritePreset) 或自定义参数
2. 调用 `/api/rewrite/stream`（SSE）：创建 Job(type=REWRITE)+Step(REWRITE)，并订阅 step 输出
3. worker（role=pipeline）执行 REWRITE step，增量写入 `Step.outputRef.text`
4. 生成/更新 RewriteVersion（状态: GENERATED），进入人工审核：APPROVED / REJECTED / REWORK

**核心文件**:
- `src/app/content/[id]/rewrite/page.tsx` - 改写页面
- `src/app/api/rewrite/stream/route.ts` - 流式 API
- `src/server/ai/rewrite.ts` - OpenAI rewrite（无 key 时 mock）
- `src/server/orchestrator/handlers/rewrite.ts` - REWRITE step handler
- `src/stores/rewriteStore.ts` - 改写状态管理

### 3. 发布管理 (Publish)

**入口**: `/publish` 和 `/content/[id]/publish`

**流程**:
1. 选择已审核的 RewriteVersion
2. 设置定时（可选），调用 `/api/publish/jobs` 创建 PublishJob，同时创建 Job(type=PUBLISH)+Step(PUBLISH)
3. Step.availableAt 用于定时：到点后可被 worker 领取执行
4. worker（role=publish）使用 Playwright session 发布到 X（Settings → Integrations 登录一次即可）
5. 写入 PublishResult，并更新 PublishJob/ContentItem 状态

**核心文件**:
- `src/app/publish/page.tsx` - 发布队列
- `src/app/api/publish/jobs/route.ts` - 发布任务 API
- `src/app/api/publish/browser/route.ts` - 浏览器会话登录/检测
- `src/server/orchestrator/handlers/publish.ts` - PUBLISH step handler
- `src/server/publish/xPublisher.ts` - Playwright 发布实现
- `src/server/x/playwrightSession.ts` - 会话存储（.playwright-data/x-session）

### 4. 自动同步 (Sync)

**入口**: `/automation`

**流程**:
1. 选择同步来源 (LIKES / BOOKMARKS / TIMELINE)
2. 设置目标 Pool 和配置
3. 创建 SyncJob，同时创建 Job(type=SYNC_*) + Step(CAPTURE)
4. worker（role=capture）使用 Playwright session 抓取推文链接（Likes/Bookmarks/Timeline）
5. 对每条推文调用入库逻辑（自动去重），并更新 SyncJob 进度

**核心文件**:
- `src/app/automation/page.tsx` - 同步管理页面
- `src/app/api/sync/jobs/route.ts` - 同步任务 API
- `src/server/sync/xSync.ts` - Playwright 抓取 URL
- `src/server/sync/runSyncJob.ts` - SyncJob runner（逐条入库 + 进度）
- `src/server/orchestrator/handlers/capture.ts` - SYNC_* CAPTURE step handler
- `src/stores/syncStore.ts` - 同步状态管理

---

## 数据模型

### 核心模型关系

```
Workspace (工作区)
├── Job[] (统一编排任务)
│   └── Step[] (步骤/队列：availableAt + retries)
├── Pool[] (素材池)
│   └── ContentItem[] (内容条目)
│       ├── RewriteVersion[] (改写版本：可追踪 jobId/stepId)
│       ├── PublishResult[] (发布结果)
│       └── AuditLog[] (审计日志)
├── Tag[] (标签)
├── RewritePreset[] (改写预设)
├── IngestJob[] / SyncJob[] / PublishJob[] / RewriteBatch[]（v1 业务任务表，逐步映射到 Job/Step）
└── XAccount? (X 账号)
```

### 关键枚举状态

#### CaptureStatus (采集状态)
| 状态 | 说明 |
|------|------|
| `QUEUED` | 排队中 |
| `FETCHING` | 正在抓取 |
| `READY` | 已就绪 |
| `FAILED` | 失败 |

#### RewriteStatus (改写状态)
| 状态 | 说明 |
|------|------|
| `NONE` | 未改写 |
| `DRAFTING` | 正在生成 |
| `GENERATED` | 已生成待审核 |
| `APPROVED` | 已通过 |
| `REWORK` | 需修改 |
| `REJECTED` | 已拒绝 |

#### PublishStatus (发布状态)
| 状态 | 说明 |
|------|------|
| `NOT_PUBLISHED` | 未发布 |
| `QUEUED` | 排队中 |
| `PUBLISHED` | 已发布 |
| `FAILED` | 失败 |

---

## API 端点

### 内容管理

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/pools/items` | 获取内容列表 (分页+筛选) |
| GET | `/api/content-items/[itemId]` | 获取单条内容详情 |
| PATCH | `/api/content-items/[itemId]` | 更新内容 (notes, status) |
| DELETE | `/api/content-items/[itemId]` | 删除内容 |
| POST | `/api/pools/items` | 批量操作 (addTags, move, archive) |

### 入库任务

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/ingest/jobs` | 获取任务列表 |
| POST | `/api/ingest/jobs` | 创建入库任务 |
| GET | `/api/ingest/jobs/[jobId]` | 获取任务详情 |

### 改写

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/rewrite/stream` | 流式改写 (SSE) |
| GET | `/api/rewrite/batches` | 获取批次列表 |
| PATCH | `/api/rewrite/versions/[versionId]` | 更新版本状态 |

### 发布

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/publish/jobs` | 获取发布任务列表 |
| POST | `/api/publish/jobs` | 创建发布任务 |
| PATCH | `/api/publish/jobs/[jobId]` | 更新任务状态 |
| GET | `/api/publish/queue` | 获取发布队列开关 |
| POST | `/api/publish/queue` | 暂停/恢复发布队列（更新编排任务状态） |
| GET | `/api/publish/browser` | 检测 Playwright 登录会话 |
| POST | `/api/publish/browser` | 打开浏览器登录/（可选）手动发帖 |

### 同步

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/sync/jobs` | 获取同步任务列表 |
| POST | `/api/sync/jobs` | 创建同步任务 |
| PATCH | `/api/sync/jobs/[jobId]` | 暂停/恢复/取消 |

### 统一任务中心 (Job/Step)

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/jobs` | 统一任务列表 |
| GET | `/api/jobs/[jobId]` | 任务详情 + Steps 时间线 |
| POST | `/api/steps/[stepId]/retry` | 重试某一步 |
| POST | `/api/jobs/[jobId]/rerun-from` | 从某一步重跑（重置后续 steps） |

### 其他

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/workspaces` | 获取工作区列表 |
| GET | `/api/tags` | 获取标签列表 |
| GET | `/api/dashboard/stats` | 获取统计数据 |
| GET | `/api/audit` | 获取审计日志 |

---

## 状态管理

使用 Zustand 管理客户端状态，所有 store 位于 `src/stores/`：

| Store | 职责 |
|-------|------|
| `workspaceStore` | 当前工作区、Pool 列表、切换逻辑 |
| `poolStore` | 素材池内容列表、分页、筛选 |
| `ingestStore` | 入库任务状态、轮询 |
| `rewriteStore` | 改写参数、流式输出、版本管理 |
| `publishStore` | 发布队列、定时任务 |
| `syncStore` | 同步任务状态 |
| `auditStore` | 审计日志 |
| `localeStore` | 语言切换 (en/zh) |

### 持久化

`workspaceStore` 使用 `persist` 中间件将 `currentWorkspaceId` 存储到 localStorage。

---

## 路由结构

### 主导航

| 路由 | 页面 | 说明 |
|------|------|------|
| `/content` | 内容列表 | 统一工作台，URL 筛选 |
| `/jobs` | 任务中心 | 统一查看 Job/Steps、错误与重试 |
| `/rewrite` | Rewrite Studio | 批量改写审核工作台 |
| `/publish` | 发布队列 | 管理发布任务 |
| `/automation` | 自动化 | 同步任务管理 |
| `/settings` | 设置 | 工作区、预设配置 |

### 内容子路由

| 路由 | 页面 |
|------|------|
| `/content/ingest` | 采集入库 (全流程) |
| `/content/[id]` | 内容详情 (Workflow Stepper) |
| `/content/[id]/rewrite` | 改写编辑 |
| `/content/[id]/publish` | 发布配置 |

### 重定向 (middleware.ts)

旧路由自动跳转：
- `/` → `/content`
- `/ingest` → `/content/ingest`
- `/pools` → `/content`
- `/sync` → `/automation`

---

## 开发指南

### 添加新的 API 端点

1. 在 `src/app/api/` 下创建 `your-endpoint/route.ts`
2. 导出 `GET`, `POST`, `PATCH`, `DELETE` 函数
3. 使用 `prisma` 访问数据库

```typescript
import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(request: NextRequest) {
    const data = await prisma.yourModel.findMany()
    return NextResponse.json({ data })
}
```

### 添加新的页面

1. 在 `src/app/` 下创建 `your-page/page.tsx`
2. 使用 `PageShell` 组件保持布局一致
3. 客户端组件需要 `"use client"` 指令

```tsx
"use client"
import { PageShell } from "@/components/layout/PageShell"

export default function YourPage() {
    return (
        <PageShell title="页面标题" description="描述">
            {/* 内容 */}
        </PageShell>
    )
}
```

### 添加新的 UI 组件

项目使用 shadcn/ui，添加新组件：

```bash
# 由于没有 components.json，需手动创建
# 参考 src/components/ui/ 下现有组件的结构
```

### 数据库迁移

```bash
# 1. 修改 prisma/schema.prisma
# 2. 推送变更
npm run db:push

# 或创建迁移 (生产环境推荐)
npm run db:migrate
```

### 国际化

翻译文件位于 `src/i18n/translations/`:
- `en.ts` - 英文
- `zh.ts` - 中文

添加新翻译键后，在组件中使用：

```tsx
const { t } = useTranslations()
<span>{t.yourKey.subKey}</span>
```

---

## 常见问题

### Q: 入库任务一直停在 QUEUED 状态？

**A**: 需要启动 worker 处理 Step 队列（可用 role 拆分）：

```bash
npm run worker
# 或仅跑采集/同步
WORKER_ROLE=capture npm run worker
```

### Q: /api/rewrite/stream 一直没有输出？

**A**: `/api/rewrite/stream` 现在是“订阅 step 输出”，实际生成在 worker（role=pipeline）里跑：

```bash
WORKER_ROLE=pipeline npm run worker
```

并可到 `/jobs` 查看对应 REWRITE step 是否在 RUNNING/FAILED（失败可点 Retry）。

### Q: Sync/Publish 提示未登录（X session）？

**A**: Sync/Publish 依赖 Playwright 登录态：
1. 打开 `/settings` → Integrations → Open Browser
2. 在弹出的 Chromium 里登录 X
3. 会话会保存到 `.playwright-data/x-session`，后续 worker 可 headless 复用

### Q: yt-dlp 报错 429 或需要登录？

**A**: 配置 cookies：
1. 安装浏览器扩展导出 X 的 cookies
2. 保存为 Netscape 格式的 `cookies.txt`
3. 设置 `YTDLP_COOKIES=/path/to/cookies.txt`

### Q: 如何查看数据库数据？

**A**: 使用 Prisma Studio：

```bash
npm run db:studio
```

### Q: 开发服务器启动报错 "端口被占用"？

**A**: 杀掉占用端口的进程：

```bash
lsof -ti:3000 | xargs kill -9
npm run dev
```

### Q: TypeScript 类型报错？

**A**: 重新生成 Prisma 客户端：

```bash
npx prisma generate
```

---

## 待开发功能

根据 PRD，以下功能待实现：

- [ ] Activity Drawer (替代 /audit 页面)
- [ ] 发布队列拖拽排序
- [ ] 发布历史筛选
- [ ] Settings 页面分组优化
- [ ] 多用户支持
- [ ] Webhook 集成

---

## 联系方式

如有问题，请联系项目负责人或查阅 PRD.md。
