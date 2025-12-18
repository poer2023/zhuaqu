# ==================== 基础镜像 ====================
FROM node:20-bookworm-slim AS base

# 安装系统依赖（Playwright 需要）
RUN apt-get update && apt-get install -y \
    # Playwright 依赖
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libatspi2.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    # yt-dlp 依赖
    python3 \
    ffmpeg \
    # 工具
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 安装 yt-dlp
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

# ==================== 依赖安装阶段 ====================
FROM base AS deps

# 复制包管理文件
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# 安装依赖
RUN npm ci

# 安装 Playwright 浏览器
RUN npx playwright install chromium

# ==================== 构建阶段 ====================
FROM base AS builder

WORKDIR /app

# 复制依赖
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /root/.cache/ms-playwright /root/.cache/ms-playwright

# 复制源码
COPY . .

# 生成 Prisma Client
RUN npx prisma generate

# 构建 Next.js
RUN npm run build

# ==================== 生产镜像 ====================
FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 创建非 root 用户
RUN groupadd --gid 1001 nodejs \
    && useradd --uid 1001 --gid nodejs --shell /bin/bash --create-home nextjs

# 复制必要文件
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# 复制 Playwright 浏览器
COPY --from=deps /root/.cache/ms-playwright /root/.cache/ms-playwright

# 创建媒体目录
RUN mkdir -p /app/data/media && chown -R nextjs:nodejs /app/data

# 设置权限
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 默认启动 Web 服务
CMD ["node", "server.js"]

