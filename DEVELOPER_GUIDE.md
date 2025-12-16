# ZhaQu 开发文档

> 内容采集、改写、发布一体化平台  
> 版本: 0.1.0 | 更新日期: 2025-12-16

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
URL输入 → 采集入库 → AI改写 → 人工审核 → 定时发布
           ↓
       ContentItem
       (QUEUED → READY)
           ↓
     RewriteVersion
     (GENERATED → APPROVED)
           ↓
       PublishJob
     (QUEUED → PUBLISHED)
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
| **AI** | Google Gemini API |
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

# AI API (必需)
GEMINI_API_KEY="your-gemini-api-key"
GEMINI_MODEL="gemini-2.5-flash"

# 本地媒体存储
MEDIA_DIR="data/media"

# yt-dlp (可选，用于视频下载)
YTDLP_COOKIES=""

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret"

# X OAuth (发布功能)
TWITTER_CLIENT_ID=""
TWITTER_CLIENT_SECRET=""
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
│   │   ├── ai/               # AI 调用 (Gemini)
│   │   ├── jobs/             # 后台任务处理
│   │   ├── media/            # 媒体下载/存储
│   │   ├── publish/          # 发布执行器
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
3. 调用 `/api/ingest/jobs` 创建 IngestJob
4. Worker 轮询处理：
   - 解析 URL → 调用 yt-dlp 抓取元数据 → 创建 ContentItem
   - 可选下载视频/图片到本地

**核心文件**:
- `src/app/content/ingest/page.tsx` - 采集页面
- `src/app/api/ingest/jobs/route.ts` - 创建任务 API
- `src/server/jobs/ingest.ts` - 任务执行逻辑
- `src/server/x/ytDlp.ts` - yt-dlp 封装

### 2. AI 改写 (Rewrite)

**入口**: `/content/[id]/rewrite`

**流程**:
1. 选择改写预设 (RewritePreset)
2. 调用 `/api/rewrite/stream` 流式生成改写内容
3. 创建 RewriteVersion (状态: GENERATED)
4. 人工审核：APPROVED / REJECTED / REWORK

**核心文件**:
- `src/app/content/[id]/rewrite/page.tsx` - 改写页面
- `src/app/api/rewrite/stream/route.ts` - 流式 API
- `src/server/ai/gemini.ts` - Gemini 调用封装
- `src/stores/rewriteStore.ts` - 改写状态管理

### 3. 发布管理 (Publish)

**入口**: `/publish` 和 `/content/[id]/publish`

**流程**:
1. 选择已审核的 RewriteVersion
2. 设置发布渠道 (XAccount) 和定时
3. 创建 PublishJob (状态: QUEUED/SCHEDULED)
4. Worker 或定时器执行发布
5. 记录 PublishResult

**核心文件**:
- `src/app/publish/page.tsx` - 发布队列
- `src/app/api/publish/jobs/route.ts` - 发布任务 API
- `src/server/publish/executor.ts` - 发布执行器

### 4. 自动同步 (Sync)

**入口**: `/automation`

**流程**:
1. 选择同步来源 (LIKES / BOOKMARKS / TIMELINE)
2. 设置目标 Pool 和配置
3. 创建 SyncJob
4. Worker 使用 X GraphQL API 批量拉取
5. 自动去重并创建 ContentItem

**核心文件**:
- `src/app/automation/page.tsx` - 同步管理页面
- `src/app/api/sync/jobs/route.ts` - 同步任务 API
- `src/server/x/xGraphql.ts` - X GraphQL 客户端
- `src/stores/syncStore.ts` - 同步状态管理

---

## 数据模型

### 核心模型关系

```
Workspace (工作区)
├── Pool[] (素材池)
│   └── ContentItem[] (内容条目)
│       ├── RewriteVersion[] (改写版本)
│       ├── PublishResult[] (发布结果)
│       └── AuditLog[] (审计日志)
├── Tag[] (标签)
├── RewritePreset[] (改写预设)
├── IngestJob[] (入库任务)
├── SyncJob[] (同步任务)
├── PublishJob[] (发布任务)
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

### 同步

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/sync/jobs` | 获取同步任务列表 |
| POST | `/api/sync/jobs` | 创建同步任务 |
| PATCH | `/api/sync/jobs/[jobId]` | 暂停/恢复/取消 |

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

### 主导航 (4 项)

| 路由 | 页面 | 说明 |
|------|------|------|
| `/content` | 内容列表 | 统一工作台，URL 筛选 |
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

**A**: 需要启动 Worker 处理后台任务：

```bash
npm run worker
```

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
